import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmailClient } from '@azure/communication-email';
import sql from 'mssql';
import PDFDocument from 'pdfkit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read appsettings.json
const appSettingsPath = path.join(__dirname, '..', 'appsettings.json');
let appSettings = {};
try {
  const appSettingsData = await fs.readFile(appSettingsPath, 'utf-8');
  appSettings = JSON.parse(appSettingsData);
} catch (error) {
  console.warn('Failed to read appsettings.json:', error.message);
}

export const PORT = Number(process.env.PORT) || 3001;
const DB_CONNECTION_STRING =
  process.env.DB_CONNECTION_STRING ||
  appSettings.azure?.database?.connectionString ||
  '';

const CLIENT_BUILD_PATH = path.join(__dirname, '..', 'dist');

const TABLES = {
  enquiries: 'Enquiries',
  users: 'Users',
  accounts: 'Accounts',
  contacts: 'Contacts',
  salesLeads: 'SalesLeads',
  deals: 'Deals',
  salesRegions: 'SalesRegions',
  leadSources: 'LeadSources',
  emailGroups: 'EmailGroups',
  quotations: 'Quotations',
  salesOrders: 'SalesOrders',
  products: 'Products',
};

let dbPool = null;
async function getDbPool() {
  if (!dbPool) {
    if (!DB_CONNECTION_STRING) {
      throw new Error('Database connection string is not configured');
    }
    dbPool = await sql.connect(DB_CONNECTION_STRING);
  }
  return dbPool;
}

function serializeValue(value) {
  if (value === undefined) {
    return null;
  }
  if (value === null) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    return JSON.stringify(value);
  }
  return value;
}

function isDateField(fieldName) {
  return /date|time/i.test(fieldName);
}

function normalizeColumnValue(fieldName, value) {
  if (value === undefined || value === '') {
    return null;
  }
  if (value === null) {
    return null;
  }
  if (isDateField(fieldName)) {
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (!normalized) {
        return null;
      }
      const parsed = new Date(normalized);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
      return null;
    }
  }
  return value;
}

function safeParseJson(value) {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeRow(row) {
  const normalized = { ...row };
  for (const key of Object.keys(normalized)) {
    normalized[key] = safeParseJson(normalized[key]);
  }
  return normalized;
}

function getUniqueColumnEntries(values) {
  const seenColumns = new Set();
  const entries = [];

  for (const [columnName, value] of Object.entries(values)) {
    const normalizedName = String(columnName).trim().toLowerCase();
    if (seenColumns.has(normalizedName)) {
      continue;
    }

    seenColumns.add(normalizedName);
    entries.push([columnName, value]);
  }

  return entries;
}

function createSqlBindings(request, values) {
  const bindings = [];
  let index = 0;

  for (const [columnName, value] of getUniqueColumnEntries(values)) {
    const paramName = `p${index}`;
    index += 1;

    request.input(paramName, serializeValue(normalizeColumnValue(columnName, value)));
    bindings.push({ columnName, paramName });
  }

  return bindings;
}

async function queryDb(query, params = {}) {
  const pool = await getDbPool();
  const request = pool.request();
  for (const [name, value] of Object.entries(params)) {
    request.input(name, serializeValue(value));
  }
  const result = await request.query(query);
  return result.recordset || [];
}

async function readTable(tableName) {
  const rows = await queryDb(`SELECT * FROM ${tableName}`);
  return rows.map(normalizeRow);
}

async function  writeTable(tableName, rows) {
  if (!Array.isArray(rows)) {
    throw new Error('Data must be an array');
  }
  const pool = await getDbPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    for (const row of rows) {
      const columnEntries = getUniqueColumnEntries(row);
      if (columnEntries.length === 0) {
        continue;
      }
      const columnList = columnEntries.map(([name]) => `[${name}]`).join(', ');
      const insertRequest = transaction.request();
      const bindings = createSqlBindings(insertRequest, Object.fromEntries(columnEntries));
      const valueList = bindings.map((binding) => `@${binding.paramName}`).join(', ');
      const query = `INSERT INTO ${tableName} (${columnList}) VALUES (${valueList})`;
      await insertRequest.query(query);
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function writeUpdate(tableName, row) {
  if (!row || typeof row !== 'object') {
    throw new Error('Row must be an object');
  }

  const pool = await getDbPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // determine key column: prefer id/Id, else first property ending with Id
    let keyName = null;
    if (Object.prototype.hasOwnProperty.call(row, 'id')) keyName = 'id';
    else if (Object.prototype.hasOwnProperty.call(row, 'Id')) keyName = 'Id';
    else {
      for (const k of Object.keys(row)) {
        if (/Id$/i.test(k) && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
          keyName = k;
          break;
        }
      }
    }

    if (!keyName) {
      keyName = 'id';
      row.id = Date.now();
    }

    const keyValue = normalizeColumnValue(keyName, row[keyName]);

    // check existence
    const checkReq = transaction.request();
    checkReq.input('key', serializeValue(keyValue));
    const existsRes = await checkReq.query(`SELECT COUNT(1) AS cnt FROM ${tableName} WHERE [${keyName}] = @key`);
    const exists = (existsRes.recordset && existsRes.recordset[0] && existsRes.recordset[0].cnt) > 0;

    if (exists) {
      // build update for all columns except key
      const columnEntries = getUniqueColumnEntries(
        Object.fromEntries(
          Object.entries(row).filter(([columnName]) => String(columnName).toLowerCase() !== String(keyName).toLowerCase())
        )
      );
      if (columnEntries.length > 0) {
        const updateReq = transaction.request();
        updateReq.input('key', serializeValue(keyValue));
        const columnValues = Object.fromEntries(columnEntries);
        const bindings = createSqlBindings(updateReq, columnValues);
        const setClauses = bindings.map((binding) => `[${binding.columnName}] = @${binding.paramName}`).join(', ');
        await updateReq.query(`UPDATE ${tableName} SET ${setClauses} WHERE [${keyName}] = @key`);
      }
    } else {
      // insert single row
      const columnEntries = getUniqueColumnEntries(row);
      const columnList = columnEntries.map(([name]) => `[${name}]`).join(', ');
      const insertReq = transaction.request();
      const bindings = createSqlBindings(insertReq, Object.fromEntries(columnEntries));
      const valueList = bindings.map((binding) => `@${binding.paramName}`).join(', ');
      await insertReq.query(`INSERT INTO ${tableName} (${columnList}) VALUES (${valueList})`);
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  if (tableName.toLowerCase() === 'deals') {
    sendDealCreatedEmail(row, false); // Additional logic for sales leads if needed
  }

  if (tableName.toLowerCase() === 'salesleads') {
    sendLeadCreatedEmail(row, false); 
  }
}

async function deleteTable(tableName, keyName, keyValue) {
  const pool = await getDbPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    const request = transaction.request();
    request.input('key', serializeValue(normalizeColumnValue(keyName, keyValue)));
    await request.query(`DELETE FROM ${tableName} WHERE [${keyName}] = @key`);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}


const readEnquiries = () => readTable(TABLES.enquiries);
const writeEnquiries = (data) => writeTable(TABLES.enquiries, data);
const updateEnquiries = (row) => writeUpdate(TABLES.enquiries, row);
const deleteEnquiries = (id) => deleteTable(TABLES.enquiries, 'id', id);

const readUsers = () => readTable(TABLES.users);
const writeUsers = (data) => writeTable(TABLES.users, data);
const updateUsers = (row) => writeUpdate(TABLES.users, row);
const deleteUsers = (id) => deleteTable(TABLES.users, 'id', id);
const readAccounts = () => readTable(TABLES.accounts);
const writeAccounts = (data) => writeTable(TABLES.accounts, data);
const updateAccounts = (row) => writeUpdate(TABLES.accounts, row);
const deleteAccounts = (id) => deleteTable(TABLES.accounts, 'id', id);
const readContacts = () => readTable(TABLES.contacts);
const writeContacts = (data) => writeTable(TABLES.contacts, data);
const updateContacts = (row) => writeUpdate(TABLES.contacts, row);
const deleteContacts = (id) => deleteTable(TABLES.contacts, 'id', id);
const readSalesLeads = () => readTable(TABLES.salesLeads);
const writeSalesLeads = (data) => writeTable(TABLES.salesLeads, data);
const updateSalesLeads = (row) => writeUpdate(TABLES.salesLeads, row);
const deleteSalesLeads = (id) => deleteTable(TABLES.salesLeads, 'id', id);
const readDeals = () => readTable(TABLES.deals);
const writeDeals = (data) => writeTable(TABLES.deals, data);
const updateDeals = (row) => writeUpdate(TABLES.deals, row);
const deleteDeals = (id) => deleteTable(TABLES.deals, 'id', id);
const readLeadSources = () => readTable(TABLES.leadSources);
const writeLeadSources = (data) => writeTable(TABLES.leadSources, data);
const updateLeadSources = (row) => writeUpdate(TABLES.leadSources, row);
const deleteLeadSources = (id) => deleteTable(TABLES.leadSources, 'id', id);
const readEmailGroups = () => readTable(TABLES.emailGroups);
const writeEmailGroups = (data) => writeTable(TABLES.emailGroups, data);
const updateEmailGroups = (row) => writeUpdate(TABLES.emailGroups, row);
const deleteEmailGroups = (id) => deleteTable(TABLES.emailGroups, 'id', id);
const readSalesRegions = () => readTable(TABLES.salesRegions);
const writeSalesRegions = (data) => writeTable(TABLES.salesRegions, data);
const updateSalesRegions = (row) => writeUpdate(TABLES.salesRegions, row);
const deleteSalesRegions = (id) => deleteTable(TABLES.salesRegions, 'id', id);
const readQuotations = readQuotes;
const writeQuotations = async (data) => writeQuotes(data);
const updateQuotations = (row) => writeUpdate(TABLES.quotations, row);
const deleteQuotations = (id) => deleteTable(TABLES.quotations, 'QuoteId', id);

// Sales Orders storage (JSON payload stored in SalesOrders table)
async function readSalesOrders() {
  try {
    const rows = await queryDb(`SELECT SalesOrderId, SalesOrderJson, CreatedDate, UpdatedDate FROM ${TABLES.salesOrders}`);
    return rows.map((r) => {
      const parsed = safeParseJson(r.SalesOrderJson);
      const orderObj = typeof parsed === 'object' ? parsed : safeParseJson(String(r.SalesOrderJson || '{}'));
      const result = { ...(orderObj || {}), id: r.SalesOrderId };
      if (r.CreatedDate) result.createdAt = new Date(r.CreatedDate).toISOString();
      if (r.UpdatedDate) result.updatedAt = new Date(r.UpdatedDate).toISOString();
      return result;
    });
  } catch (error) {
    console.error('readSalesOrders error:', error && error.message ? error.message : error);
    return [];
  }
}

async function writeSalesOrders(orders) {
  for (const o of orders) {
    const SalesOrderId = o.id || o.SalesOrderId || generateSalesOrderId();
    const SalesOrderJson = typeof o === 'string' ? o : JSON.stringify(o);
    const row = {
      SalesOrderId,
      SalesOrderJson,
      UpdatedDate: new Date().toISOString(),
    };
    if (o.createdAt) row.CreatedDate = new Date(o.createdAt);
    await writeUpdate(TABLES.salesOrders, row);
  }
}

const readSalesOrdersTable = readSalesOrders;
const writeSalesOrdersTable = writeSalesOrders;
const updateSalesOrders = (row) => writeUpdate(TABLES.salesOrders, row);
const deleteSalesOrders = (id) => deleteTable(TABLES.salesOrders, 'SalesOrderId', id);
const readProducts = () => readTable(TABLES.products);
const writeProducts = (data) => writeTable(TABLES.products, data);
const updateProducts = (row) => writeUpdate(TABLES.products, row);
const deleteProducts = (id) => deleteTable(TABLES.products, 'id', id);
const updateTable = writeUpdate;

// Quotation storage now uses the database table `Quotations`.
async function readQuotes() {
  try {
    const rows = await queryDb(`SELECT QuoteId, QuotationJson, CreatedDate, UpdatedDate FROM ${TABLES.quotations}`);
    return rows.map((r) => {
      const parsed = safeParseJson(r.QuotationJson);
      const quoteObj = typeof parsed === 'object' ? parsed : safeParseJson(String(r.QuotationJson || '{}'));
      const result = { ...(quoteObj || {}), id: r.QuoteId };
      if (r.CreatedDate) result.createdAt = new Date(r.CreatedDate).toISOString();
      if (r.UpdatedDate) result.updatedAt = new Date(r.UpdatedDate).toISOString();
      return result;
    });
  } catch (error) {
    console.error('readQuotes error:', error && error.message ? error.message : error);
    return [];
  }
}

async function writeQuotes(quotes) {
  // Upsert each quote row into the Quotations table.
  for (const q of quotes) {
    const QuoteId = q.id || q.QuoteId || generateQuoteId();
    const QuotationJson = typeof q === 'string' ? q : JSON.stringify(q);
    const row = {
      QuoteId,
      QuotationJson,
      UpdatedDate: new Date().toISOString(),
    };
    if (q.createdAt) row.CreatedDate = new Date(q.createdAt);
    await writeUpdate(TABLES.quotations, row);
  }
}

function generateQuoteId() {
  return 'Q' + Date.now() + Math.random().toString(36).substr(2, 9);
}

function generateSalesOrderId() {
  // Format AUR-2XXXXX where XXXXX is 5 digits
  const num = Math.floor(10000 + Math.random() * 90000);
  return `AUR-2${String(num)}`;
}

const AZURE_EMAIL_CONNECTION_STRING = appSettings.azure?.email?.connectionString || '';
const AZURE_EMAIL_FROM_ADDRESS = appSettings.azure?.email?.fromAddress || 'no-reply@satvian.com';
const AZURE_EMAIL_RECIPIENTS =
  (process.env.AZURE_EMAIL_RECIPIENTS?.split(',').map((address) => address.trim()).filter(Boolean)) || 
  (appSettings.azure?.email?.recipients && Array.isArray(appSettings.azure.email.recipients) 
    ? appSettings.azure.email.recipients 
    : []);

let emailClient = null;
if (AZURE_EMAIL_CONNECTION_STRING) {
  try {
    emailClient = new EmailClient(AZURE_EMAIL_CONNECTION_STRING);
  } catch (err) {
    // Don't throw during import (vite dev server). Log and disable email feature.
    console.warn('Azure EmailClient initialization failed, email disabled:', err && err.message ? err.message : err);
    emailClient = null;
  }
}
//az communication email domain show --name satviandomainemail.axurecomm.net --email-service-name satvianemailservcie --resource-group SatvianCRM --subscription 35e977f7-0b10-40c1-835a-f920c1f05f87
 // az communication email show --name satviancrmemail --resource-group SatvianCRM --subscription 35e977f7-0b10-40c1-835a-f920c1f05f87

function matchId(record, id) {
  return String(record.id) === String(id);
}

function matchID(record, id) {
  return String(record.Id) === String(id);
}

function sanitizeUser(user) {
  const { password: _password, ...safe } = user;
  return safe;
}

function getLeadEmailRecipients(lead) {
  const recipients = [];
  if (!emailClient) {
    return recipients;
  }

  const configuredRecipients = AZURE_EMAIL_RECIPIENTS.map((email) => ({
    email,
    displayName: email,
  }));

  recipients.push(...configuredRecipients);

  if (lead.leadContactId) {
    const contacts = readContacts();
    return contacts.then((allContacts) => {
      const contact = allContacts.find((c) => matchId(c, lead.leadContactId));
      if (contact?.email) {
        recipients.push({
          email: contact.email,
          displayName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email,
        });
      }
      return recipients;
    });
  }

  return Promise.resolve(recipients);
}

async function sendLeadCreatedEmail(lead, isNew = true) {
  if (!emailClient) {
    return;
  }

  const recipients = await getLeadEmailRecipients(lead);
  if (!recipients.length) {
    return;
  }

  var subject = `New Sales Lead: ${lead.title} - ${lead.companyName}`;
  if (!isNew) {
    subject = `Sales Lead Updated: ${lead.title} - ${lead.companyName}`;
  }

  const plainText = `NEW SALES LEAD ALERT
========================

Opportunity Title:
${lead.title}

Company:
${lead.companyName}

Sales Point of Contact:
${lead.salesPoc}

Contact Name:
${lead.leadContact}

Lead Region:
${lead.leadRegion}

Lead Source:
${lead.leadSource}

Opportunity Tasks:
${lead.tasks || 'No tasks provided.'}

Opportunity Description:
${lead.description}

Lead Status:
${lead.leadStatus || 'New'}

Lead Rating:
${lead.leadRating || 'Warm'}

Next Contact Date:
${lead.nextContactDate || 'Not scheduled'}

Priority: ${lead.targetDealAmount ? 'HIGH - Deal amount: ' + lead.targetDealAmount : 'STANDARD'}

========================
This is an automated notification from the CRM system.
Log in to your CRM dashboard to view full details and take action.`;

  const htmlText = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
    <div style="background-color: #ffffff; margin: 20px auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 600px; overflow: hidden;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); padding: 30px 20px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">🎯 New Sales Lead Alert</h1>
            <p style="margin: 8px 0 0 0; color: #ecf0f1; font-size: 14px;">Action Required</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px 20px;">
            <!-- Lead Title Section -->
            <div style="background-color: #ecf0f1; border-left: 4px solid #2c3e50; padding: 15px; border-radius: 4px; margin-bottom: 25px;">
                <p style="margin: 0; color: #7f8c8d; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Opportunity Title</p>
                <h2 style="margin: 8px 0 0 0; color: #2c3e50; font-size: 20px;">${lead.title}</h2>
            </div>

            <!-- Key Information Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
                <!-- Company -->
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px;">
                    <p style="margin: 0; color: #7f8c8d; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Company</p>
                    <p style="margin: 8px 0 0 0; color: #2c3e50; font-size: 15px; font-weight: 500;">${lead.companyName}</p>
                </div>

                <!-- Region -->
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px;">
                    <p style="margin: 0; color: #7f8c8d; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Region</p>
                    <p style="margin: 8px 0 0 0; color: #2c3e50; font-size: 15px; font-weight: 500;">${lead.leadRegion}</p>
                </div>

                <!-- Lead Source -->
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px;">
                    <p style="margin: 0; color: #7f8c8d; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Lead Source</p>
                    <p style="margin: 8px 0 0 0; color: #2c3e50; font-size: 15px; font-weight: 500;">${lead.leadSource}</p>
                </div>

                <!-- Sales POC -->
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px;">
                    <p style="margin: 0; color: #7f8c8d; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Sales POC</p>
                    <p style="margin: 8px 0 0 0; color: #2c3e50; font-size: 15px; font-weight: 500;">${lead.salesPoc}</p>
                </div>

                <!-- Contact Name -->
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px;">
                    <p style="margin: 0; color: #7f8c8d; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Contact Name</p>
                    <p style="margin: 8px 0 0 0; color: #2c3e50; font-size: 15px; font-weight: 500;">${lead.leadContact}</p>
                </div>

                <!-- Lead Status -->
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px;">
                    <p style="margin: 0; color: #7f8c8d; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Status</p>
                    <p style="margin: 8px 0 0 0; color: #27ae60; font-size: 15px; font-weight: 600;">${lead.leadStatus || 'New'}</p>
                </div>
            </div>

             <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin-bottom: 25px;">
                <p style="margin: 0; color: #7f8c8d; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 8px;">Tasks</p>
                <p style="margin: 0; color: #2c3e50; font-size: 14px; line-height: 1.6;">${lead.tasks}</p>
            </div>

            <!-- Description Section -->
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin-bottom: 25px;">
                <p style="margin: 0; color: #7f8c8d; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 8px;">Description</p>
                <p style="margin: 0; color: #2c3e50; font-size: 14px; line-height: 1.6;">${lead.description}</p>
            </div>

            <!-- Additional Details -->
            <div style="background-color: #ecf7ed; border-left: 4px solid #27ae60; padding: 15px; border-radius: 4px; margin-bottom: 25px;">
                <p style="margin: 0; color: #27ae60; font-size: 12px; font-weight: 600; margin-bottom: 10px;">⏰ NEXT ACTIONS</p>
                <table style="width: 100%; font-size: 14px;">
                    <tr>
                        <td style="color: #7f8c8d; padding: 5px 0;">Next Contact Date:</td>
                        <td style="color: #2c3e50; font-weight: 600; padding: 5px 0;">${lead.nextContactDate || 'Not scheduled'}</td>
                    </tr>
                    <tr>
                        <td style="color: #7f8c8d; padding: 5px 0;">Lead Rating:</td>
                        <td style="color: #2c3e50; font-weight: 600; padding: 5px 0;">${lead.leadRating || 'Warm'}</td>
                    </tr>
                    ${lead.targetDealAmount ? `<tr>
                        <td style="color: #7f8c8d; padding: 5px 0;">Target Deal Amount:</td>
                        <td style="color: #e74c3c; font-weight: 600; padding: 5px 0;">${lead.targetDealAmount}</td>
                    </tr>` : ''}
                </table>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin-bottom: 25px;">
                <a href="https://satviancrmtest-h2ckhfe4a8fcf9du.centralus-01.azurewebsites.net/login" style="display: inline-block; background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: #ffffff; padding: 14px 40px; border-radius: 4px; text-decoration: none; font-weight: 600; font-size: 15px; transition: opacity 0.3s;">View Lead in CRM →</a>
            </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #ecf0f1; padding: 20px; border-top: 1px solid #bdc3c7; text-align: center;">
            <p style="margin: 0; color: #7f8c8d; font-size: 12px; line-height: 1.6;">
                This is an automated notification from the Satvian CRM system.<br>
                Please do not reply to this email. Log in to your CRM dashboard for more details.
            </p>
            <p style="margin: 12px 0 0 0; color: #95a5a6; font-size: 11px;">
                © 2026 Satvian Communications. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>`;

  try {
    const sender = AZURE_EMAIL_FROM_ADDRESS;
    if (sender === 'no-reply@company.com') {
      console.warn(
        'Azure email sender address is not configured. Set AZURE_EMAIL_FROM_ADDRESS to a verified sender address.'
      );
    }

    // const sendRequest = {
    //   sender,
    //   senderAddress: 'DoNotReply@4e025037-239a-4f46-88c6-0351eaf58bb5.azurecomm.net',
    //   content: {
    //     subject,
    //     plainText,
    //     html,
    //   },
    //   recipients: [{address :'geteme1.pavan@gmail.com'}] ,
    // };

    // build `to` recipients: include configured recipients + the LeadsAlerts-NewOrModify group
    const emailGroups = await readEmailGroups();
    const leadAlertGroup = emailGroups.find((g) => g.name === 'LeadsAlerts-NewOrModify');
    const groupEmails = leadAlertGroup && leadAlertGroup.emailIds
      ? leadAlertGroup.emailIds.split(/[;,]+/).map((e) => e.trim()).filter(Boolean)
      : [];

    const toRecipients = [
      ...groupEmails.map((email) => ({ address: email })),
    ];

    const emailMessage = {
      senderAddress: "DoNotReply@4e025037-239a-4f46-88c6-0351eaf58bb5.azurecomm.net",
      content: {
        subject: subject,
        plainText: plainText,
        html: htmlText,
      },
      recipients: {
        to: toRecipients,
      },
    };

    if (typeof emailClient.send === 'function') {
      await emailClient.send(emailMessage);
    } else if (typeof emailClient.sendEmail === 'function') {
      await emailClient.sendEmail(emailMessage);
    } else if (typeof emailClient.beginSend === 'function') {
      const poller = await emailClient.beginSend(emailMessage);
      if (poller && typeof poller.pollUntilDone === 'function') {
        await poller.pollUntilDone();
      }
    } else {
      console.warn('No supported send method found on emailClient; email not sent');
    }
  } catch (error) {
    console.error('Failed to send lead creation email:', {
      message: error?.message,
      code: error?.code,
      statusCode: error?.statusCode,
      details: error?.details,
      stack: error?.stack,
    });
  }
}

async function sendDealCreatedEmail(deal, isNew = true) {
  if (!emailClient) {
    return;
  }

  try {
    const emailGroups = await readEmailGroups();
    const dealGroup = emailGroups.find((g) => g.name === 'Deals');
    const groupEmails = dealGroup && dealGroup.emailIds
      ? dealGroup.emailIds.split(/[;,]+/).map((e) => e.trim()).filter(Boolean)
      : [];

    if (!groupEmails.length) {
      console.warn('No recipients configured for Deals email group');
      return;
    }

    var subject = `New Deal Created: ${deal.dealName} - ${deal.account}`;
    if (!isNew) {
      subject = `Deal Updated: ${deal.dealName} - ${deal.account}`;
    }
    const plainText = `NEW DEAL ALERT
========================

Deal Name:
${deal.dealName}

Account:
${deal.account}

Sales POC:
${deal.salesPoc}

Deal Stage:
${deal.dealStage || 'New'}

Deal Amount:
${deal.dealAmount || 'Not specified'}

Probability:
${deal.probability}%

Expected Closure Date:
${deal.expectedClosureDate || 'Not scheduled'}

Region:
${deal.region || 'Not specified'}

Description:
${deal.description}

========================
This is an automated notification from the CRM system.
Log in to your CRM dashboard to view full details and take action.`;

    const htmlText = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
    <div style="background-color: #ffffff; margin: 20px auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 600px; overflow: hidden;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); padding: 30px 20px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">💼 New Deal Created</h1>
            <p style="margin: 8px 0 0 0; color: #ecf0f1; font-size: 14px;">Action Required</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px 20px;">
            <!-- Deal Title Section -->
            <div style="background-color: #ecf0f1; border-left: 4px solid #2c3e50; padding: 15px; border-radius: 4px; margin-bottom: 25px;">
                <p style="margin: 0; color: #7f8c8d; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Deal Name</p>
                <h2 style="margin: 8px 0 0 0; color: #2c3e50; font-size: 20px;">${deal.dealName}</h2>
            </div>

            <!-- Key Information Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
                <!-- Account -->
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px;">
                    <p style="margin: 0; color: #7f8c8d; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Account</p>
                    <p style="margin: 8px 0 0 0; color: #2c3e50; font-size: 15px; font-weight: 500;">${deal.account}</p>
                </div>

                <!-- Deal Stage -->
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px;">
                    <p style="margin: 0; color: #7f8c8d; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Stage</p>
                    <p style="margin: 8px 0 0 0; color: #2c3e50; font-size: 15px; font-weight: 500;">${deal.dealStage || 'New'}</p>
                </div>

                <!-- Deal Amount -->
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px;">
                    <p style="margin: 0; color: #7f8c8d; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Deal Amount</p>
                    <p style="margin: 8px 0 0 0; color: #2c3e50; font-size: 15px; font-weight: 500;">${deal.dealAmount || 'Not specified'}</p>
                </div>

                <!-- Probability -->
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px;">
                    <p style="margin: 0; color: #7f8c8d; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Probability</p>
                    <p style="margin: 8px 0 0 0; color: #2c3e50; font-size: 15px; font-weight: 500;">${deal.probability}%</p>
                </div>

                <!-- Sales POC -->
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px;">
                    <p style="margin: 0; color: #7f8c8d; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Sales POC</p>
                    <p style="margin: 8px 0 0 0; color: #2c3e50; font-size: 15px; font-weight: 500;">${deal.salesPoc}</p>
                </div>

                <!-- Region -->
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px;">
                    <p style="margin: 0; color: #7f8c8d; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Region</p>
                    <p style="margin: 8px 0 0 0; color: #2c3e50; font-size: 15px; font-weight: 500;">${deal.region || 'Not specified'}</p>
                </div>
            </div>

            <!-- Description Section -->
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin-bottom: 25px;">
                <p style="margin: 0; color: #7f8c8d; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 8px;">Description</p>
                <p style="margin: 0; color: #2c3e50; font-size: 14px; line-height: 1.6;">${deal.description}</p>
            </div>

            <!-- Additional Details -->
            <div style="background-color: #ecf7ed; border-left: 4px solid #27ae60; padding: 15px; border-radius: 4px; margin-bottom: 25px;">
                <p style="margin: 0; color: #27ae60; font-size: 12px; font-weight: 600; margin-bottom: 10px;">📅 KEY DATES</p>
                <table style="width: 100%; font-size: 14px;">
                    <tr>
                        <td style="color: #7f8c8d; padding: 5px 0;">Expected Closure Date:</td>
                        <td style="color: #2c3e50; font-weight: 600; padding: 5px 0;">${deal.expectedClosureDate || 'Not scheduled'}</td>
                    </tr>
                </table>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin-bottom: 25px;">
                <a href="https://satviancrmtest-h2ckhfe4a8fcf9du.centralus-01.azurewebsites.net/login" style="display: inline-block; background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: #ffffff; padding: 14px 40px; border-radius: 4px; text-decoration: none; font-weight: 600; font-size: 15px; transition: opacity 0.3s;">View Deal in CRM →</a>
            </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #ecf0f1; padding: 20px; border-top: 1px solid #bdc3c7; text-align: center;">
            <p style="margin: 0; color: #7f8c8d; font-size: 12px; line-height: 1.6;">
                This is an automated notification from the Satvian CRM system.<br>
                Please do not reply to this email. Log in to your CRM dashboard for more details.
            </p>
            <p style="margin: 12px 0 0 0; color: #95a5a6; font-size: 11px;">
                © 2026 Satvian Communications. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>`;

    const toRecipients = groupEmails.map((email) => ({ address: email }));

    const emailMessage = {
      senderAddress: AZURE_EMAIL_FROM_ADDRESS,
      content: {
        subject: subject,
        plainText: plainText,
        html: htmlText,
      },
      recipients: {
        to: toRecipients,
      },
    };

    if (typeof emailClient.send === 'function') {
      await emailClient.send(emailMessage);
    } else if (typeof emailClient.sendEmail === 'function') {
      await emailClient.sendEmail(emailMessage);
    } else if (typeof emailClient.beginSend === 'function') {
      const poller = await emailClient.beginSend(emailMessage);
      if (poller && typeof poller.pollUntilDone === 'function') {
        await poller.pollUntilDone();
      }
    } else {
      console.warn('No supported send method found on emailClient; email not sent');
    }
  } catch (error) {
    console.error('Failed to send deal creation email:', {
      message: error?.message,
      code: error?.code,
      statusCode: error?.statusCode,
      details: error?.details,
      stack: error?.stack,
    });
  }
}

function validateUserFields(body, { requirePassword }) {
  const {
    fullName,
    email,
    username,
    password,
    role,
    phone,
    employeeId,
    reportingManager,
    region,
    status,
  } = body;
  if (!fullName?.trim() || !email?.trim() || !username?.trim()) {
    return { error: 'fullName, email, and username are required' };
  }
  if (requirePassword && !password?.trim()) {
    return { error: 'password is required' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { error: 'invalid email address' };
  }
  const normalizedRole = role?.trim() || 'user';
  const normalizedStatus =
    status?.trim().toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
  return {
    data: {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      username: username.trim(),
      password: password?.trim(),
      role: normalizedRole.toLowerCase() === 'admin' ? 'admin' : normalizedRole,
      phone: phone?.trim() || '',
      employeeId: employeeId?.trim() || '',
      reportingManager: reportingManager?.trim() || '',
      region: region?.trim() || '',
      status: normalizedStatus,
    },
  };
}

function userExists(users, { email, username }, excludeId) {
  return users.some(
    (u) =>
      !matchId(u, excludeId) &&
      (u.email === email || u.username === username)
  );
}

function parseEnquiryBody(body) {
  return {
    enquiryNo: body.enquiryNo?.trim() || '',
    salesPoc: body.salesPoc?.trim() || '',
    region: body.region?.trim() || '',
    customerName:
      body.customerName?.trim() || body.name?.trim() || '',
    contactPerson: body.contactPerson?.trim() || '',
    contactMobile: body.contactMobile?.trim() || '',
    contactEmail: body.contactEmail?.trim().toLowerCase() || '',
    description: body.description?.trim() || '',
    date: body.date || '',
    notes: body.notes?.trim() || '',
  };
}

function validateEnquiry(body) {
  if (!body.enquiryNo) {
    return { error: 'Enquiry number is required' };
  }
  if (!body.customerName) {
    return { error: 'Name of the customer is required' };
  }
  if (!body.salesPoc) {
    return { error: 'Sales POC is required' };
  }
  if (!body.region) {
    return { error: 'Region is required' };
  }
  if (!body.contactPerson) {
    return { error: 'Contact person is required' };
  }
  if (!body.contactMobile) {
    return { error: 'Contact person mobile is required' };
  }
  if (!body.contactEmail) {
    return { error: 'Contact person email is required' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.contactEmail)) {
    return { error: 'Invalid contact person email' };
  }
  if (!body.date) {
    return { error: 'Date is required' };
  }
  return { data: body };
}

function parseAccountBody(body) {
  return {
    companyName: body.companyName?.trim() || '',
    address: body.address?.trim() || '',
    city: body.city?.trim() || '',
    state: body.state?.trim() || '',
    country: body.country?.trim() || '',
    pinZip: body.pinZip?.trim() || '',
    industry: body.industry?.trim() || '',
    website: body.website?.trim() || '',
    phone: body.phone || '',
    employees: body.employees || '',
    annualRevenue: body.annualRevenue || '',
    region: body.region?.trim() || '',
    status: body.status || 'Active',
    health: body.health || 'Green',
    owner: body.owner?.trim() || '',
    startDate: body.startDate || '',
    gstNumber: body.gstNumber?.trim() || '',
    description: body.description?.trim() || '',
    notes: body.notes?.trim() || '',
    tasks: body.tasks?.trim() || '',
    leads: Array.isArray(body.leads) ? body.leads : [],
    contacts: Array.isArray(body.contacts) ? body.contacts : [],
    deals: Array.isArray(body.deals) ? body.deals : [],
    createdBy: body.createdBy?.trim() || '',
    createdDate: body.createdDate || '',
    updatedBy: body.updatedBy?.trim() || '',
    updatedDate: body.updatedDate || '',
  };
}

function validateAccount(body) {
  if (!body.companyName) {
    return { error: 'Company name is required' };
  }
  if (!body.owner) {
    return { error: 'Account owner is required' };
  }
  if (!body.region) {
    return { error: 'Region is required' };
  }
  return { data: body };
}

function parseContactBody(body) {
  return {
    salutation: body.salutation?.trim() || '',
    firstName: body.firstName?.trim() || '',
    lastName: body.lastName?.trim() || '',
    designation: body.designation?.trim() || '',
    department: body.department?.trim() || '',
    mobile: body.mobile?.trim() || '',
    email: body.email?.trim().toLowerCase() || '',
    status: body.status || 'Active',
    description: body.description?.trim() || '',
    doNotCall: Boolean(body.doNotCall),
    emailOptOut: Boolean(body.emailOptOut),
    fax: body.fax?.trim() || '',
    assistantName: body.assistantName?.trim() || '',
    assistantPhone: body.assistantPhone?.trim() || '',
    attachments: body.attachments?.trim() || '',
    address: body.address?.trim() || '',
    city: body.city?.trim() || '',
    state: body.state?.trim() || '',
    country: body.country?.trim() || '',
    pinZip: body.pinZip?.trim() || '',
    notes: body.notes?.trim() || '',
    tasks: body.tasks?.trim() || '',
    leads: Array.isArray(body.leads) ? body.leads : [],
    createdBy: body.createdBy?.trim() || '',
    createdDate: body.createdDate || '',
    updatedBy: body.updatedBy?.trim() || '',
    updatedDate: body.updatedDate || '',
  };
}

function validateContact(body) {
  if (!body.firstName) {
    return { error: 'First name is required' };
  }
  if (!body.lastName) {
    return { error: 'Last name is required' };
  }
  if (!body.mobile) {
    return { error: 'Mobile is required' };
  }
  if (!body.email) {
    return { error: 'Email is required' };
  }
  return { data: body };
}

function parseSalesLeadBody(body) {
  return {
    title: body.title?.trim() || '',
    receivedDate: body.receivedDate || '',
    salesPoc: body.salesPoc?.trim() || '',
    salutation: body.salutation?.trim() || '',
    leadContact: body.leadContact?.trim() || '',
    leadContactId: body.leadContactId || '',
    leadStatus: body.leadStatus || 'New',
    leadRating: body.leadRating || 'Warm',
    nextContactDate: body.nextContactDate || '',
    leadRegion: body.leadRegion?.trim() || '',
    leadSource: body.leadSource?.trim() || '',
    referredBy: body.referredBy?.trim() || '',
    notes: body.notes?.trim() || '',
    description: body.description?.trim() || '',
    productType: body.productType?.trim() || '',
    targetDealAmount: body.targetDealAmount || '',
    attachments: body.attachments?.trim() || '',
    companyName: body.companyName?.trim() || '',
    companyId: body.companyId || '',
    tasks: body.tasks?.trim() || '',
    activities: body.activities?.trim() || '',
    createdBy: body.createdBy?.trim() || '',
    createdDate: body.createdDate || '',
    updatedBy: body.updatedBy?.trim() || '',
    updatedDate: body.updatedDate || '',
  };
}

function parseDealBody(body) {
  return {
    dealName: body.dealName?.trim() || '',
    account: body.account?.trim() || '',
    accountId: body.accountId || '',
    primaryContact: body.primaryContact?.trim() || '',
    leadId: body.leadId || '',
    salesPoc: body.salesPoc?.trim() || '',
    dealStage: body.dealStage || 'New',
    dealAmount: body.dealAmount || 0,
    probability: Number(body.probability) || 0,
    expectedClosureDate: body.expectedClosureDate || '',
    competitor: body.competitor?.trim() || '',
    dealSource: body.dealSource?.trim() || '',
    productSubType: body.productSubType?.trim() || '',
    description: body.description?.trim() || '',
    lostReason: body.lostReason?.trim() || '',
    wonDate: body.wonDate || '',
    region: body.region?.trim() || '',
    attachments: body.attachments?.trim() || '',
    extraFields: body.extraFields || {},
    createdBy: body.createdBy?.trim() || '',
    createdDate: body.createdDate || '',
    updatedBy: body.updatedBy?.trim() || '',
    updatedDate: body.updatedDate || '',
    notes: body.notes?.trim() || '',
    tasks: body.tasks?.trim() || '',
    activities: body.activities?.trim() || '',
  };
}

function validateDeal(body) {
  if (!body.dealName) {
    return { error: 'Deal name is required' };
  }
  if (!body.account) {
    return { error: 'Account is required' };
  }
  if (!body.salesPoc) {
    return { error: 'Sales POC is required' };
  }
  if (!body.dealStage) {
    return { error: 'Deal stage is required' };
  }
  return { data: body };
}

function buildDealRecord(data, existing = {}) {
  return {
    ...existing,
    dealName: data.dealName,
    account: data.account,
    accountId: data.accountId,
    primaryContact: data.primaryContact,
    leadId: data.leadId,
    salesPoc: data.salesPoc,
    dealStage: data.dealStage,
    dealAmount: data.dealAmount,
    probability: data.probability,
    expectedClosureDate: data.expectedClosureDate,
    competitor: data.competitor,
    dealSource: data.dealSource,
    productSubType: data.productSubType,
    description: data.description,
    lostReason: data.lostReason,
    wonDate: data.wonDate,
    region: data.region,
    attachments: data.attachments,
    extraFields: data.extraFields,
    createdBy: data.createdBy,
    createdDate: data.createdDate,
    updatedBy: data.updatedBy,
    updatedDate: data.updatedDate,
    notes: data.notes,
    tasks: data.tasks,
    activities: data.activities,
  };
}

function validateSalesLead(body) {
  if (!body.title) {
    return { error: 'Lead title is required' };
  }
  if (!body.salesPoc) {
    return { error: 'Sales POC is required' };
  }
  if (!body.leadRegion) {
    return { error: 'Lead region is required' };
  }
  if (!body.description) {
    return { error: 'Description is required' };
  }
  if (!body.productType) {
    return { error: 'Product type is required' };
  }
  if (!body.companyName) {
    return { error: 'Company name is required' };
  }
  return { data: body };
}

function buildSalesLeadRecord(data, existing = {}) {
  return {
    ...existing,
    title: data.title,
    receivedDate: data.receivedDate,
    salesPoc: data.salesPoc,
    salutation: data.salutation,
    leadContact: data.leadContact,
    leadContactId: data.leadContactId,
    leadStatus: data.leadStatus,
    leadRating: data.leadRating,
    nextContactDate: data.nextContactDate,
    leadRegion: data.leadRegion,
    leadSource: data.leadSource,
    referredBy: data.referredBy,
    notes: data.notes,
    description: data.description,
    productType: data.productType,
    targetDealAmount: data.targetDealAmount,
    attachments: data.attachments,
    companyName: data.companyName,
    companyId: data.companyId,
    tasks: data.tasks,
    activities: data.activities,
    createdBy: data.createdBy,
    createdDate: data.createdDate,
    updatedBy: data.updatedBy,
    updatedDate: data.updatedDate,
  };
}

function parseSalesRegionBody(body) {
  return {
    regionId: body.regionId?.trim() || '',
    regionCode: body.regionCode?.trim() || '',
    name: body.name?.trim() || '',
    description: body.description?.trim() || '',
    createdBy: body.createdBy?.trim() || '',
    createdDate: body.createdDate || '',
    updatedBy: body.updatedBy?.trim() || '',
    updatedDate: body.updatedDate || '',
  };
}

function validateSalesRegion(body) {
  if (!body.name) {
    return { error: 'Region name is required' };
  }
  return { data: body };
}

function parseLeadSourceBody(body) {
  return {
    name: body.name?.trim() || '',
    description: body.description?.trim() || '',
    status: body.status?.trim() || 'Active',
    createdBy: body.createdBy?.trim() || '',
    createdDate: body.createdDate || '',
    updatedBy: body.updatedBy?.trim() || '',
    updatedDate: body.updatedDate || '',
  };
}

function validateLeadSource(body) {
  if (!body.name) {
    return { error: 'Source name is required' };
  }
  return { data: body };
}

function parseEmailGroupBody(body) {
  return {
    name: body.name?.trim() || '',
    emailIds: body.emailIds?.trim() || '',
    createdBy: body.createdBy?.trim() || '',
    createdDate: body.createdDate || '',
    updatedBy: body.updatedBy?.trim() || '',
    updatedDate: body.updatedDate || '',
  };
}

function validateEmailGroup(body) {
  if (!body.name) {
    return { error: 'Email group name is required' };
  }
  if (!body.emailIds) {
    return { error: 'Email IDs are required' };
  }
  return { data: body };
}

function buildContactRecord(data, existing = {}) {
  return {
    ...existing,
    salutation: data.salutation,
    firstName: data.firstName,
    lastName: data.lastName,
    designation: data.designation,
    department: data.department,
    mobile: data.mobile,
    email: data.email,
    status: data.status,
    description: data.description,
    doNotCall: data.doNotCall,
    emailOptOut: data.emailOptOut,
    fax: data.fax,
    assistantName: data.assistantName,
    assistantPhone: data.assistantPhone,
    attachments: data.attachments,
    address: data.address,
    city: data.city,
    state: data.state,
    country: data.country,
    pinZip: data.pinZip,
    notes: data.notes,
    tasks: data.tasks,
    createdBy: data.createdBy,
    createdDate: data.createdDate,
    updatedBy: data.updatedBy,
    updatedDate: data.updatedDate,
  };
}

function buildAccountRecord(data, existing = {}) {
  return {
    ...existing,
    CompanyName: data.companyName,
    Address: data.address,
    City: data.city,
    State: data.state,
    Country: data.country,
    PinZip: data.pinZip,
    Industry: data.industry,
    Website: data.website,
    Phone: data.phone,
    Employees: data.employees,
    AnnualRevenue: data.annualRevenue,
    Region: data.region,
    Status: data.status,
    Health: data.health,
    Owner: data.owner,
    StartDate: data.startDate,
    GstNumber: data.gstNumber,
    Description: data.description,
    Notes: data.notes,
    Tasks: data.tasks,
    CreatedBy: data.createdBy,
    CreatedDate: data.createdDate,
    UpdatedBy: data.updatedBy,
    UpdatedDate: data.updatedDate,
  };
}

function buildEmailGroupRecord(data, existing = {}) {
  return {
    ...existing,
    name: data.name,
    emailIds: data.emailIds,
    createdBy: data.createdBy,
    createdDate: data.createdDate,
    updatedBy: data.updatedBy,
    updatedDate: data.updatedDate,
  };
}

function buildSalesRegionRecord(data, existing = {}) {
  return {
    ...existing,
    regionId: data.regionId || existing.regionId || `REG-${Date.now()}`,
    regionCode: data.regionCode || existing.regionCode || '',
    name: data.name,
    description: data.description,
    createdBy: data.createdBy,
    createdDate: data.createdDate,
    updatedBy: data.updatedBy,
    updatedDate: data.updatedDate,
  };
}

function buildLeadSourceRecord(data, existing = {}) {
  return {
    ...existing,
    name: data.name,
    description: data.description,
    status: data.status || existing.status || 'Active',
    createdBy: data.createdBy,
    createdDate: data.createdDate,
    updatedBy: data.updatedBy,
    updatedDate: data.updatedDate,
  };
}

function buildEnquiryRecord(data, existing = {}) {
  return {
    ...existing,
    enquiryNo: data.enquiryNo,
    salesPoc: data.salesPoc,
    region: data.region,
    customerName: data.customerName,
    contactPerson: data.contactPerson,
    contactMobile: data.contactMobile,
    contactEmail: data.contactEmail,
    description: data.description,
    date: data.date,
    notes: data.notes,
  };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

function getRequestUser(req) {
  const id = req.headers['x-user-id'];
  const role = req.headers['x-user-role'];
  if (!id || !role) {
    return null;
  }
  return { id: String(id), role };
}

function requireAuth(req, res, next) {
  const user = getRequestUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.authUser = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.authUser.role?.toLowerCase() !== 'admin') {
      return res.status(403).json({ error: 'User access denied' });
  }
  next();
}

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username?.trim() || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const users = await readUsers();
    const user = users.find(
      (u) => u.username === username.trim() && u.password === password
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Helper to coerce different representations to boolean
    const toBool = (v) => {
      if (v === true) return true;
      if (v === false) return false;
      if (v === undefined || v === null) return false;
      const s = String(v).trim().toLowerCase();
      return s === 'true' || s === '1';
    };

    // If user is already active on another device, deny login
    if (toBool(user.IsActive) || toBool(user.isActive) || toBool(user.is_active)) {
      return res.status(403).json({ error: "This User is already logged-in on another device, please log-out and re-attempt to login-in here again." });
    }

    // Mark user as active and set LoggedIn timestamp
    const now = new Date().toISOString();

    // Choose the primary key field that exists on the user record
    const updatePayload = {};
    if (Object.prototype.hasOwnProperty.call(user, 'id')) updatePayload.id = user.id;
    else if (Object.prototype.hasOwnProperty.call(user, 'Id')) updatePayload.Id = user.Id;
    else if (Object.prototype.hasOwnProperty.call(user, 'ID')) updatePayload.ID = user.ID;
    else updatePayload.id = user.id ?? Date.now();

    updatePayload.IsActive = true;
    updatePayload.LoggedIn = now;

    await updateUsers(updatePayload);

    // Return the refreshed user record (sanitized)
    const refreshed = await readUsers();
    const updatedUser = refreshed.find((u) => {
      if (updatePayload.id !== undefined) return String(u.id) === String(updatePayload.id);
      if (updatePayload.Id !== undefined) return String(u.Id) === String(updatePayload.Id);
      if (updatePayload.ID !== undefined) return String(u.ID) === String(updatePayload.ID);
      return false;
    }) || { ...user, IsActive: true, LoggedIn: now };

    res.json(sanitizeUser(updatedUser));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout: clear IsActive and optionally set LoggedOut time
app.post('/api/auth/logout', requireAuth, async (req, res) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) return res.status(400).json({ error: 'Invalid user' });

    const now = new Date().toISOString();
    const payload = { id: userId, IsActive: false, LoggedOut: now };
    await updateUsers(payload);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/enquiries', requireAuth, async (_req, res) => {
  try {
    res.json(await readEnquiries());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/enquiries/:id', requireAuth, async (req, res) => {
  try {
    const enquiries = await readEnquiries();
    const enquiry = enquiries.find((e) => matchId(e, req.params.id));
    if (!enquiry) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }
    res.json(enquiry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/enquiries', requireAuth, async (req, res) => {
  try {
    const validation = validateEnquiry(parseEnquiryBody(req.body));
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const newEnquiry = {
      id: Date.now(),
      ...buildEnquiryRecord(validation.data),
      createdAt: new Date().toISOString(),
    };
    await updateEnquiries(newEnquiry);
    res.status(201).json(newEnquiry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/enquiries/:id', requireAuth, async (req, res) => {
  try {
    const enquiries = await readEnquiries();
    const index = enquiries.findIndex((e) => matchId(e, req.params.id));
    if (index === -1) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    const validation = validateEnquiry(parseEnquiryBody(req.body));
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const updated = {
      ...enquiries[index],
      ...buildEnquiryRecord(validation.data, enquiries[index]),
      updatedAt: new Date().toISOString(),
    };
    delete updated.name;
    await updateEnquiries(updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/enquiries/:id', requireAuth, async (req, res) => {
  try {
    const enquiries = await readEnquiries();
    const enquiry = enquiries.find((e) => matchId(e, req.params.id));
    if (!enquiry) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }
    await deleteEnquiries(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/enquiries', requireAuth, async (req, res) => {
  try {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Body must be an array of enquiries' });
    }
    await writeEnquiries(req.body);
    res.json(req.body);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/accounts', requireAuth, async (_req, res) => {
  try {
    res.json(await readAccounts());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/accounts/:id', requireAuth, async (req, res) => {
  try {
    const accounts = await readAccounts();
    const account = accounts.find((a) => matchID(a, req.params.id));
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/accounts', requireAuth, async (req, res) => {
  try {
    const validation = validateAccount(parseAccountBody(req.body));
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const newAccount = {
      Id: Date.now(),
      ...buildAccountRecord(validation.data),
      CreatedDate: new Date().toISOString(),
      UpdatedDate: new Date().toISOString(),
    };
    await updateAccounts(newAccount);
    res.status(201).json(newAccount);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/accounts/:id', requireAuth, async (req, res) => {
  try {
    const accounts = await readAccounts();
    const index = accounts.findIndex((a) => matchID(a, req.params.id));
    if (index === -1) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const validation = validateAccount(parseAccountBody(req.body));
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const updated = {
      ...accounts[index],
      ...buildAccountRecord(validation.data, accounts[index]),
      UpdatedDate: new Date().toISOString(),
    };
    await updateAccounts(updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/accounts/:id', requireAuth, async (req, res) => {
  try {
    const accounts = await readAccounts();
    const account = accounts.find((a) => matchID(a, req.params.id));
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    await deleteAccounts(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/contacts', requireAuth, async (_req, res) => {
  try {
    res.json(await readContacts());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products', requireAuth, async (_req, res) => {
  try {
    res.json(await readProducts());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/:id', requireAuth, async (req, res) => {
  try {
    const products = await readProducts();
    const product = products.find((p) => matchId(p, req.params.id));
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', requireAuth, async (req, res) => {
  try {
    const newProduct = {
      id: Date.now(),
      productCode: req.body?.productCode ?? '',
      productName: req.body?.productName ?? '',
      productDesciption: req.body?.productDesciption ?? '',
      unitMeasurements: req.body?.unitMeasurements ?? '',
      salePrice: req.body?.salePrice === '' ? '' : (req.body?.salePrice ?? ''),
      createdBy: req.body?.createdBy ?? 'System',
      createdDate: new Date().toISOString(),
      updatedBy: req.body?.updatedBy ?? 'System',
      updatedDate: new Date().toISOString(),
    };
    await updateProducts(newProduct);
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', requireAuth, async (req, res) => {
  try {
    const products = await readProducts();
    const index = products.findIndex((p) => matchId(p, req.params.id));
    if (index === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const updated = {
      ...products[index],
      productCode: req.body?.productCode ?? products[index].productCode ?? '',
      productName: req.body?.productName ?? products[index].productName ?? '',
      productDesciption: req.body?.productDesciption ?? products[index].productDesciption ?? '',
      unitMeasurements: req.body?.unitMeasurements ?? products[index].unitMeasurements ?? '',
      salePrice: req.body?.salePrice === undefined
        ? (products[index].salePrice ?? '')
        : (req.body.salePrice === '' ? '' : Number(req.body.salePrice)),
      updatedBy: req.body?.updatedBy ?? 'System',
      updatedDate: new Date().toISOString(),
    };
    await updateProducts(updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', requireAuth, async (req, res) => {
  try {
    const products = await readProducts();
    const product = products.find((p) => matchId(p, req.params.id));
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    await deleteProducts(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/contacts/:id', requireAuth, async (req, res) => {
  try {
    const contacts = await readContacts();
    const contact = contacts.find((c) => matchId(c, req.params.id));
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/contacts', requireAuth, async (req, res) => {
  try {
    const validation = validateContact(parseContactBody(req.body));
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const newContact = {
      id: Date.now(),
      ...buildContactRecord(validation.data),
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    await updateContacts(newContact);
    res.status(201).json(newContact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/contacts/:id', requireAuth, async (req, res) => {
  try {
    const contacts = await readContacts();
    const index = contacts.findIndex((c) => matchId(c, req.params.id));
    if (index === -1) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const validation = validateContact(parseContactBody(req.body));
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const updated = {
      ...contacts[index],
      ...buildContactRecord(validation.data, contacts[index]),
      updatedDate: new Date().toISOString(),
    };
    await updateContacts(updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/contacts/:id', requireAuth, async (req, res) => {
  try {
    const contacts = await readContacts();
    const contact = contacts.find((c) => matchId(c, req.params.id));
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    await deleteContacts(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sales-leads', requireAuth, async (_req, res) => {
  try {
    res.json(await readSalesLeads());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sales-leads/:id', requireAuth, async (req, res) => {
  try {
    const leads = await readSalesLeads();
    const lead = leads.find((l) => matchId(l, req.params.id));
    if (!lead) {
      return res.status(404).json({ error: 'Sales lead not found' });
    }
    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sales-leads', requireAuth, async (req, res) => {
  try {
    const validation = validateSalesLead(parseSalesLeadBody(req.body));
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const newLead = {
      id: Date.now(),
      ...buildSalesLeadRecord(validation.data),
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    await updateSalesLeads(newLead);

    sendLeadCreatedEmail(newLead).catch((error) => {
      console.error('Error sending new lead notification email:', error);
    });

    res.status(201).json(newLead);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sales-leads/:id', requireAuth, async (req, res) => {
  try {
    const leads = await readSalesLeads();
    const index = leads.findIndex((l) => matchId(l, req.params.id));
    if (index === -1) {
      return res.status(404).json({ error: 'Sales lead not found' });
    }

    const validation = validateSalesLead(parseSalesLeadBody(req.body));
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const updated = {
      ...leads[index],
      ...buildSalesLeadRecord(validation.data, leads[index]),
      updatedDate: new Date().toISOString(),
    };
    await updateSalesLeads(updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/sales-leads/:id', requireAuth, async (req, res) => {
  try {
    const leads = await readSalesLeads();
    const lead = leads.find((l) => matchId(l, req.params.id));
    if (!lead) {
      return res.status(404).json({ error: 'Sales lead not found' });
    }
    await deleteSalesLeads(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/deals', requireAuth, async (_req, res) => {
  try {
    res.json(await readDeals());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/deals/:id', requireAuth, async (req, res) => {
  try {
    const deals = await readDeals();
    const deal = deals.find((d) => matchId(d, req.params.id));
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    res.json(deal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/deals', requireAuth, async (req, res) => {
  try {
    const validation = validateDeal(parseDealBody(req.body));
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const newDeal = {
      id: Date.now(),
      ...buildDealRecord(validation.data),
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    await updateDeals(newDeal);

    sendDealCreatedEmail(newDeal).catch((error) => {
      console.error('Error sending deal creation email:', error);
    });

    res.status(201).json(newDeal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/deals/:id', requireAuth, async (req, res) => {
  try {
    const deals = await readDeals();
    const index = deals.findIndex((d) => matchId(d, req.params.id));
    if (index === -1) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const validation = validateDeal(parseDealBody(req.body));
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const updated = {
      ...deals[index],
      ...buildDealRecord(validation.data, deals[index]),
      updatedDate: new Date().toISOString(),
    };
    await updateDeals(updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/deals/:id', requireAuth, async (req, res) => {
  try {
    const deals = await readDeals();
    const deal = deals.find((d) => matchId(d, req.params.id));
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    await deleteDeals(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users', requireAuth, async (_req, res) => {
  try {
    const users = await readUsers();
    res.json(users.map(sanitizeUser));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sales-regions', requireAuth, async (_req, res) => {
  try {
    res.json(await readSalesRegions());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sales-regions/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const regions = await readSalesRegions();
    const region = regions.find((r) => matchId(r, req.params.id));
    if (!region) {
      return res.status(404).json({ error: 'Sales region not found' });
    }
    res.json(region);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sales-regions', requireAuth, requireAdmin, async (req, res) => {
  try {
    const validation = validateSalesRegion(parseSalesRegionBody(req.body));
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const newRegion = {
      id: Date.now(),
      ...buildSalesRegionRecord(validation.data),
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    await updateSalesRegions(newRegion);
    res.status(201).json(newRegion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sales-regions/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const regions = await readSalesRegions();
    const index = regions.findIndex((r) => matchId(r, req.params.id));
    if (index === -1) {
      return res.status(404).json({ error: 'Sales region not found' });
    }

    const validation = validateSalesRegion(parseSalesRegionBody(req.body));
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const updated = {
      ...regions[index],
      ...buildSalesRegionRecord(validation.data, regions[index]),
      updatedDate: new Date().toISOString(),
    };

    await updateSalesRegions(updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/sales-regions/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const regions = await readSalesRegions();
    const region = regions.find((r) => matchId(r, req.params.id));
    if (!region) {
      return res.status(404).json({ error: 'Sales region not found' });
    }
    await deleteSalesRegions(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/lead-sources', requireAuth, async (_req, res) => {
  try {
    res.json(await readLeadSources());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/lead-sources/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const sources = await readLeadSources();
    const source = sources.find((s) => matchId(s, req.params.id));
    if (!source) {
      return res.status(404).json({ error: 'Lead source not found' });
    }
    res.json(source);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/lead-sources', requireAuth, requireAdmin, async (req, res) => {
  try {
    const validation = validateLeadSource(parseLeadSourceBody(req.body));
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const newSource = {
      id: Date.now(),
      ...buildLeadSourceRecord(validation.data),
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    await updateLeadSources(newSource);
    res.status(201).json(newSource);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/lead-sources/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const sources = await readLeadSources();
    const index = sources.findIndex((s) => matchId(s, req.params.id));
    if (index === -1) {
      return res.status(404).json({ error: 'Lead source not found' });
    }

    const validation = validateLeadSource(parseLeadSourceBody(req.body));
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const updated = {
      ...sources[index],
      ...buildLeadSourceRecord(validation.data, sources[index]),
      updatedDate: new Date().toISOString(),
    };
    await updateLeadSources(updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/lead-sources/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const sources = await readLeadSources();
    const source = sources.find((s) => matchId(s, req.params.id));
    if (!source) {
      return res.status(404).json({ error: 'Lead source not found' });
    }
    await deleteLeadSources(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/email-groups', requireAuth, requireAdmin, async (_req, res) => {
  try {
    res.json(await readEmailGroups());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/email-groups/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const groups = await readEmailGroups();
    const group = groups.find((g) => matchId(g, req.params.id));
    if (!group) {
      return res.status(404).json({ error: 'Email group not found' });
    }
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/email-groups', requireAuth, requireAdmin, async (req, res) => {
  try {
    const validation = validateEmailGroup(parseEmailGroupBody(req.body));
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const newGroup = {
      id: Date.now(),
      ...buildEmailGroupRecord(validation.data),
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    await updateEmailGroups(newGroup);
    res.status(201).json(newGroup);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/email-groups/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const groups = await readEmailGroups();
    const index = groups.findIndex((g) => matchId(g, req.params.id));
    if (index === -1) {
      return res.status(404).json({ error: 'Email group not found' });
    }

    const validation = validateEmailGroup(parseEmailGroupBody(req.body));
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const updated = {
      ...groups[index],
      ...buildEmailGroupRecord(validation.data, groups[index]),
      updatedDate: new Date().toISOString(),
    };
    await updateEmailGroups(updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/email-groups/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const groups = await readEmailGroups();
    const group = groups.find((g) => matchId(g, req.params.id));
    if (!group) {
      return res.status(404).json({ error: 'Email group not found' });
    }
    await deleteEmailGroups(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const isAdmin = req.authUser.role?.toLowerCase() === 'admin';
    const isSelf = matchId({ id: req.authUser.id }, req.params.id);
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const users = await readUsers();
    const user = users.find((u) => matchId(u, req.params.id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(sanitizeUser(user));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const validation = validateUserFields(req.body, { requirePassword: true });
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const users = await readUsers();
    const { data } = validation;
    if (userExists(users, data)) {
      return res.status(409).json({ error: 'email or username already exists' });
    }

    const newUser = {
      id: Date.now(),
      fullName: data.fullName,
      email: data.email,
      username: data.username,
      employeeId: data.employeeId,
      reportingManager: data.reportingManager,
      region: data.region,
      status: data.status,
      password: data.password,
      role: data.role,
      phone: data.phone,
      createdAt: new Date().toISOString(),
    };
    await updateUsers(newUser);
    res.status(201).json(sanitizeUser(newUser));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const isAdmin = req.authUser.role?.toLowerCase() === 'admin';
    const isSelf = matchId({ id: req.authUser.id }, req.params.id);
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const users = await readUsers();
    const index = users.findIndex((u) => matchId(u, req.params.id));
    if (index === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validation = validateUserFields(req.body, { requirePassword: false });
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const { data } = validation;
    if (userExists(users, data, req.params.id)) {
      return res.status(409).json({ error: 'email or username already exists' });
    }

    const updated = {
      ...users[index],
      fullName: data.fullName,
      email: data.email,
      username: data.username,
      employeeId: data.employeeId,
      reportingManager: data.reportingManager,
      region: data.region,
      status: data.status,
      password: data.password || users[index].password,
      role: isAdmin ? data.role : users[index].role,
      phone: data.phone,
      createdAt: new Date().toISOString(),
      //updatedDate: new Date().toISOString(),
    };
    if (data.password) {
      updated.password = data.password;
    }

    await updateUsers(updated);
    res.json(sanitizeUser(updated));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await readUsers();
    const user = users.find((u) => matchId(u, req.params.id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await deleteUsers(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Quotation API Routes
app.get('/api/quotes', requireAuth, async (_req, res) => {
  try {
    const quotes = await readQuotations();
    res.json(quotes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/quotes/:id', requireAuth, async (req, res) => {
  try {
    const quotes = await readQuotes();
    const quote = quotes.find((q) => q.id === req.params.id);
    if (!quote) {
      return res.status(404).json({ error: 'Quotation not found' });
    }
    res.json(quote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/quotes', requireAuth, async (req, res) => {
  try {
    const newQuote = {
      id: generateQuoteId(),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Upsert single quotation row
    await writeUpdate(TABLES.quotations, {
      QuoteId: newQuote.id,
      QuotationJson: JSON.stringify(newQuote),
      CreatedDate: new Date(newQuote.createdAt),
      UpdatedDate: new Date(newQuote.updatedAt),
    });

    res.status(201).json(newQuote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/quotes/:id', requireAuth, async (req, res) => {
  try {
    const quotes = await readQuotes();
    const existing = quotes.find((q) => q.id === req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    const updated = {
      ...existing,
      ...req.body,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await writeUpdate(TABLES.quotations, {
      QuoteId: updated.id,
      QuotationJson: JSON.stringify(updated),
      UpdatedDate: new Date(updated.updatedAt),
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/quotes/:id', requireAuth, async (req, res) => {
  try {
    // delete by QuoteId
    await deleteTable(TABLES.quotations, 'QuoteId', req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Convert a quotation to a sales order
app.post('/api/quotes/:id/convert-to-sales-order', requireAuth, async (req, res) => {
  try {
    const quotes = await readQuotes();
    const quote = quotes.find((q) => q.id === req.params.id);
    if (!quote) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    // Map quotation JSON to sales order JSON
    const salesOrderId = generateSalesOrderId();
    const now = new Date().toISOString();

    const salesOrder = {
      id: salesOrderId,
      // Basic metadata
      createdAt: now,
      updatedAt: now,
      // Copy over top-level relevant sections
      company: quote.company || {},
      customer: quote.customer || {},
      items: quote.items || [],
      commercials: quote.commercials || {},
      taxes: quote.taxes || {},
      totals: quote.totals || {},
      bankDetails: quote.bankDetails || {},
      signature: quote.signature || {},
      status: quote.status || 'Pending',
      // Map quotation.quotation -> salesOrder.salesOrder
      salesOrder: {
        salesOrderNumber: salesOrderId,
        orderType: quote.quotation?.quoteType || 'Initial',
        salesOrderDate: quote.quotation?.quotationDate || now.split('T')[0],
        deliveryDate: quote.quotation?.expiryDate || '',
        placeOfSupply: quote.quotation?.placeOfSupply || '',
        reference: quote.quotation?.reference || '',
        salesPerson: quote.quotation?.salesPerson || {},
      },
    };

    await writeUpdate(TABLES.salesOrders, {
      SalesOrderId: salesOrder.id,
      SalesOrderJson: JSON.stringify(salesOrder),
      CreatedDate: new Date(salesOrder.createdAt),
      UpdatedDate: new Date(salesOrder.updatedAt),
    });

    res.status(201).json(salesOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sales Orders API Routes
app.get('/api/sales-orders', requireAuth, async (_req, res) => {
  try {
    const orders = await readSalesOrders();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sales-orders/:id', requireAuth, async (req, res) => {
  try {
    const orders = await readSalesOrders();
    const order = orders.find((q) => q.id === req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Sales order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sales-orders', requireAuth, async (req, res) => {
  try {
    const newOrder = {
      id: generateSalesOrderId(),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await writeUpdate(TABLES.salesOrders, {
      SalesOrderId: newOrder.id,
      SalesOrderJson: JSON.stringify(newOrder),
      CreatedDate: new Date(newOrder.createdAt),
      UpdatedDate: new Date(newOrder.updatedAt),
    });

    res.status(201).json(newOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sales-orders/:id', requireAuth, async (req, res) => {
  try {
    const orders = await readSalesOrders();
    const existing = orders.find((q) => q.id === req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    const updated = {
      ...existing,
      ...req.body,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await writeUpdate(TABLES.salesOrders, {
      SalesOrderId: updated.id,
      SalesOrderJson: JSON.stringify(updated),
      UpdatedDate: new Date(updated.updatedAt),
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/sales-orders/:id', requireAuth, async (req, res) => {
  try {
    await deleteTable(TABLES.salesOrders, 'SalesOrderId', req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/quotes/:id', requireAuth, async (req, res) => {
  try {
    const quotes = await readQuotes();
    const index = quotes.findIndex((q) => q.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Quotation not found' });
    }
    quotes.splice(index, 1);
    await writeQuotes(quotes);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function createQuotePDFBuffer(quote) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(globalThis.Buffer ? globalThis.Buffer.concat(chunks) : Buffer.concat(chunks)));
      doc.on('error', reject);

      // HEADER SECTION
      doc.image('./src/assets/aaruni.png', 50, 30,{ width: 60, height: 30, align: 'right' });
      doc.fontSize(12).font('Helvetica-Bold').text(quote.company.name, 120, 40);
      doc.fontSize(9).font('Helvetica').text(quote.company.address, 50, 65);
      doc.fontSize(9).text(`Phone: ${quote.quotation.salesPerson.phone} | GSTIN: ${quote.company.gstin}`, 50, 80);
      doc.fontSize(9).text(`CIN: ${quote.company.companyId}`, 50, 95);

      // Quotation stamp
      
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#C0C0C0').text('QUOTATION', 380, 40, {
        align: 'right',
        opacity: 0.1,
      });
      doc.fillColor('black');

      doc.moveDown(1);
      doc.moveTo(50, 110).lineTo(550, 110).stroke();
      doc.moveDown(0.5);

      // QUOTE INFO SECTION
      const infoBoxLeft = 50;
      const infoBoxRight = 310;
      const infoBoxWidth = 240;
      const infoBoxHeight = 55;
      const infoBoxTop = 120;

      // Left box - Quote Details
      doc.rect(infoBoxLeft, infoBoxTop, infoBoxWidth, infoBoxHeight).stroke();
      doc.fontSize(9).font('Helvetica-Bold').text('QUOTATION DETAILS', infoBoxLeft + 8, infoBoxTop + 5, { width: infoBoxWidth - 16 });
      doc.fontSize(8).font('Helvetica');
      doc.text(`Quote #: ${quote.quotation.quoteNumber}`, infoBoxLeft + 8, infoBoxTop + 20, { width: infoBoxWidth - 16 });
      doc.text(`Type: ${quote.quotation.quoteType} | Date: ${new Date(quote.quotation.quotationDate).toLocaleDateString('en-IN')}`, infoBoxLeft + 8, infoBoxTop + 33, { width: infoBoxWidth - 16 });
      doc.text(`Valid Until: ${new Date(quote.quotation.expiryDate).toLocaleDateString('en-IN')}`, infoBoxLeft + 8, infoBoxTop + 43, { width: infoBoxWidth - 16 });

      // Right box - Reference Info
      doc.rect(infoBoxRight, infoBoxTop, infoBoxWidth, infoBoxHeight).stroke();
      doc.fontSize(9).font('Helvetica-Bold').text('REFERENCE', infoBoxRight + 8, infoBoxTop + 5, { width: infoBoxWidth - 16 });
      doc.fontSize(8).font('Helvetica');
      doc.text(`Reference: ${quote.quotation.reference}`, infoBoxRight + 8, infoBoxTop + 20, { width: infoBoxWidth - 16 });
      doc.text(`Place of Supply: ${quote.quotation.placeOfSupply}`, infoBoxRight + 8, infoBoxTop + 33, { width: infoBoxWidth - 16 });
      doc.text(`Sales Person: ${quote.quotation.salesPerson.name}`, infoBoxRight + 8, infoBoxTop + 43, { width: infoBoxWidth - 16 });

      doc.moveDown(1);

      // BILL TO AND SHIP TO SECTION
      const addressBoxWidth = 240;
      const addressBoxHeight = 95;
      const addressBoxY = doc.y;
      const addressBoxLeft = 50;
      const addressBoxRight = 310;

      // Bill To Box
      doc.rect(addressBoxLeft, addressBoxY, addressBoxWidth, addressBoxHeight).stroke();
      doc.fontSize(10).font('Helvetica-Bold').text('BILL TO', addressBoxLeft + 8, addressBoxY + 5);
      doc.fontSize(9).font('Helvetica-Bold').text(quote.customer.billTo.companyName, addressBoxLeft + 8, addressBoxY + 20, { width: addressBoxWidth - 16 });
      doc.fontSize(8).font('Helvetica');
      quote.customer.billTo.address.forEach((line, idx) => {
        doc.text(line, addressBoxLeft + 8, addressBoxY + 33 + idx * 10, { width: addressBoxWidth - 16 });
      });
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text(`Contact: ${quote.customer.customerName}`, addressBoxLeft + 8, addressBoxY + 73, { width: addressBoxWidth - 16 });
      doc.fontSize(8).font('Helvetica');
      doc.text(`Email: ${quote.customer.email}`, addressBoxLeft + 8, addressBoxY + 83, { width: addressBoxWidth - 16 });

      // Ship To Box
      doc.rect(addressBoxRight, addressBoxY, addressBoxWidth, addressBoxHeight).stroke();
      doc.fontSize(10).font('Helvetica-Bold').text('SHIP TO', addressBoxRight + 8, addressBoxY + 5);
      doc.fontSize(9).font('Helvetica-Bold').text(quote.customer.shipTo.companyName, addressBoxRight + 8, addressBoxY + 20, { width: addressBoxWidth - 16 });
      doc.fontSize(8).font('Helvetica');
      quote.customer.shipTo.address.forEach((line, idx) => {
        doc.text(line, addressBoxRight + 8, addressBoxY + 33 + idx * 10, { width: addressBoxWidth - 16 });
      });
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text(`Phone: ${quote.customer.phone}`, addressBoxRight + 8, addressBoxY + 73, { width: addressBoxWidth - 16 });

      doc.moveDown(3);

      // LINE ITEMS TABLE
      const tableTop = doc.y;
      const col1 = 50,
        col2 = 110,
        col3 = 240,
        col4 = 320,
        col5 = 390,
        col6 = 460;
      const rowHeight = 25;
      const pageWidth = 550;

      // Table Header with background
      doc.rect(col1 - 5, tableTop, pageWidth - col1 + 5, rowHeight).fillAndStroke('#2c3e50', '#2c3e50');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('white');
      doc.text('Item Code', col1, tableTop + 4, { width: 50 });
      doc.text('Product', col2, tableTop + 4, { width: 120 });
      doc.text('Qty', col3, tableTop + 4, { width: 50, align: 'center' });
      doc.text('Unit Price (₹)', col4, tableTop + 4, { width: 60, align: 'right' });
      doc.text('Discount', col5, tableTop + 4, { width: 50, align: 'center' });
      doc.text('Total (₹)', col6, tableTop + 4, { width: 60, align: 'right' });

      // Table body rows
      doc.fillColor('black');
      let currentY = tableTop + rowHeight;
      let rowNum = 0;

      quote.items.forEach((item) => {
        if (rowNum % 2 === 0) {
          doc.rect(col1 - 5, currentY, pageWidth - col1 + 5, rowHeight).fill('#f5f5f5');
        }

        const productLabel = item.description || item.productName || '-';
        const unitDetails = item.unitMeasurements ? ` (${item.unitMeasurements})` : '';

        doc.fontSize(8).font('Helvetica').fillColor('black');
        doc.text(item.itemCode || '-', col1, currentY + 4, { width: 50 });
        doc.text(`${productLabel}${unitDetails}`, col2, currentY + 4, { width: 120 });
        doc.text(String(item.quantity), col3, currentY + 4, { width: 50, align: 'center' });
        doc.text(`₹${item.unitPrice.toLocaleString('en-IN')}`, col4, currentY + 4, { width: 60, align: 'right' });
        doc.text(`${item.discountPercent}%`, col5, currentY + 4, { width: 50, align: 'center' });
        doc.text(`₹${item.lineTotal.toLocaleString('en-IN')}`, col6, currentY + 4, { width: 60, align: 'right' });

        doc.moveTo(col1 - 5, currentY + rowHeight).lineTo(pageWidth, currentY + rowHeight).stroke();
        currentY += rowHeight;
        rowNum++;
      });

      doc.moveDown(1);

      // TOTALS SECTION
      const totalsX = 380;
      const totalsY = doc.y + 8;

      const taxRows = getTaxSummaryRows(quote);

      doc.fontSize(9).font('Helvetica');
      doc.text('Subtotal:', totalsX, totalsY, { width: 80, align: 'right' });
      doc.text(`₹${quote.totals.subTotal.toLocaleString('en-IN')}`, totalsX + 85, totalsY, { width: 60, align: 'right' });
      taxRows.forEach((row, index) => {
        doc.text(`${row.label}:`, totalsX, totalsY + 15 + (index * 15), { width: 80, align: 'right' });
        doc.text(`₹${row.amount.toLocaleString('en-IN')}`, totalsX + 85, totalsY + 15 + (index * 15), { width: 60, align: 'right' });
      });

      const grandTotalBoxY = totalsY + 28 + ((taxRows.length - 1) * 15);
      doc.rect(totalsX - 5, grandTotalBoxY, 180, 22).fillAndStroke('#b8bab3', '#cae8d1');
      doc.fontSize(11).font('Helvetica-Bold').fillColor('white');
      doc.text('GRAND TOTAL:', totalsX + 2, grandTotalBoxY + 6, { width: 200, align: 'left' });
      doc.text(`₹${quote.totals.grandTotal.toLocaleString('en-IN')}`, totalsX + 84, grandTotalBoxY + 6, { width: 200, align: 'left' });

      doc.fillColor('black');
      doc.moveDown(1);

      // Amount in words
      doc.fontSize(8).font('Helvetica');
      doc.text(`Amount in Words: ${quote.totals.amountInWords}`, 50, doc.y);
      doc.moveDown(1);

      // COMMERCIAL TERMS SECTION
      doc.fontSize(10).font('Helvetica-Bold').text('Commercial Terms & Conditions', { underline: true });
      doc.fontSize(8).font('Helvetica');
      doc.text(`• Payment Terms: ${quote.commercials.paymentTerms}`);
      doc.text(`• Delivery Schedule: ${quote.commercials.deliverySchedule}`);
      doc.text(`• Shipping Charges: ${quote.commercials.shippingCharges}`);
      doc.moveDown(0.5);

      // BANK DETAILS SECTION
      const bankBoxTop = doc.y;
      doc.rect(50, bankBoxTop, 500, 70).stroke();
      doc.fontSize(10).font('Helvetica-Bold').text('Bank Details for Payment', 58, bankBoxTop + 5);
      doc.fontSize(8).font('Helvetica');
      const col1Bank = 58,
        col2Bank = 280;
      doc.text(`Account Name: ${quote.bankDetails.accountName}`, col1Bank, bankBoxTop + 20);
      doc.text(`Account Number: ${quote.bankDetails.accountNumber} | Bank Name: ${quote.bankDetails.bankName}`, col1Bank, bankBoxTop + 33);
      doc.text(`GSTIN: ${quote.company.gstin} | CIN: ${quote.company.companyId}`, col1Bank, bankBoxTop + 46);
      doc.text(`Branch: ${quote.bankDetails.branchAddress}`, col1Bank, bankBoxTop + 59);

      doc.moveDown(2);

      // FOOTER SECTION
      doc.moveTo(47, doc.y).lineTo(550, doc.y).stroke();
      doc.fontSize(8).font('Helvetica').text('Authorized Signatory', 50, doc.y + 10);
      doc.text(quote.signature.authorizedPerson, 50, doc.y + 20);
      doc.fontSize(7).font('Helvetica').fillColor('#666666');
      doc.text(`This quotation is valid till ${new Date(quote.quotation.expiryDate).toLocaleDateString('en-IN')}. Terms and conditions apply.`, 50, doc.y + 35, { align: 'center' });
      doc.text(`Generated on ${new Date().toLocaleString('en-IN')} | Quote ID: ${quote.id}`, 50, doc.y + 10, { align: 'center' });
      doc.text('© ' + quote.company.name + ' - Confidential', 50, doc.y + 5, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Generate PDF endpoint
app.get('/api/quotes/:id/pdf', requireAuth, async (req, res) => {
  try {
    const quotes = await readQuotes();
    const quote = quotes.find((q) => q.id === req.params.id);
    if (!quote) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    const pdfBuffer = await createQuotePDFBuffer(quote);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Quote_${quote.quotation.quoteNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send email endpoint
app.post('/api/quotes/:id/send-email', requireAuth, async (req, res) => {
  try {
    const quotes = await readQuotes();
    const quote = quotes.find((q) => q.id === req.params.id);
    if (!quote) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    const recipients = req.body;
    if (!recipients || recipients.length === 0) {
      return res.status(400).json({ error: 'At least one recipient is required' });
    }

    if (!emailClient) {
      return res.status(503).json({ error: 'Email service is not available' });
    }

    try {
      const data = req.body || {};

      if (!Array.isArray(data.recipients) || data.recipients.length === 0) {
        return res.status(400).json({ error: 'At least one recipient is required' });
      }

      const subject = data.subject || `Quotation ${quote.quotation.quoteNumber}`;
      const message = data.message || '';
      const emailSubject = subject;
      const htmlText = generateQuotationEmailHTML(quote, message);
      const plainText = generateQuotationPlainText(quote, message);

      const toRecipients = data.recipients.map((email) => ({ address: String(email).trim() })).filter(r => r.address);

      // Ensure attachments directory exists and save files there
      const attachmentsDir = path.join(__dirname, '..', 'attachments');
      await fs.mkdir(attachmentsDir, { recursive: true });

      // // Save generated quote PDF to attachments folder
      const pdfBuffer = await createQuotePDFBuffer(quote);
      const attachmentName = `Quote_${quote.quotation.quoteNumber}.pdf`;
      const pdfFilenameSafe = `${Date.now()}_${attachmentName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const pdfPath = path.join(attachmentsDir, pdfFilenameSafe);
      await fs.writeFile(pdfPath, pdfBuffer);

      // Build attachments array by reading files from attachments folder
      const attachments = [];

      // push the saved generated PDF
      const savedPdfBuffer = await fs.readFile(pdfPath);
      attachments.push({
        name: attachmentName,
        contentType: 'application/pdf',
        contentInBase64: savedPdfBuffer.toString('base64'),
      });

      //Merge and save additional attachments from request (base64 payloads)
      if (Array.isArray(data.attachments)) {
        for (const a of data.attachments) {
          if (a && typeof a.name === 'string' && typeof a.contentInBase64 === 'string') {
            const safeName = a.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const filename = `${Date.now()}_${safeName}`;
            attachments.push({
              name: a.name,
              contentType: a.contentType,
              contentInBase64: a.contentInBase64.toString('base64'),
            });
          }
        }
      }

      //  attachments.push({
      //         name: 'Enterprise_Quotation.pdf',
      //         contentType: 'application/pdf',
      //         contentInBase64: 'JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9aYXBmRGluZ2JhdHMgL05hbWUgL0YzIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKNSAwIG9iago8PAovQ29udGVudHMgOSAwIFIgL01lZGlhQm94IFsgMCAwIDU5NS4yNzU2IDg0MS44ODk4IF0gL1BhcmVudCA4IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago2IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgOCAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjcgMCBvYmoKPDwKL0F1dGhvciAoXChhbm9ueW1vdXNcKSkgL0NyZWF0aW9uRGF0ZSAoRDoyMDI2MDYyMjEzNDQ1MiswMCcwMCcpIC9DcmVhdG9yIChcKHVuc3BlY2lmaWVkXCkpIC9LZXl3b3JkcyAoKSAvTW9kRGF0ZSAoRDoyMDI2MDYyMjEzNDQ1MiswMCcwMCcpIC9Qcm9kdWNlciAoUmVwb3J0TGFiIFBERiBMaWJyYXJ5IC0gXChvcGVuc291cmNlXCkpIAogIC9TdWJqZWN0IChcKHVuc3BlY2lmaWVkXCkpIC9UaXRsZSAoXChhbm9ueW1vdXNcKSkgL1RyYXBwZWQgL0ZhbHNlCj4+CmVuZG9iago4IDAgb2JqCjw8Ci9Db3VudCAxIC9LaWRzIFsgNSAwIFIgXSAvVHlwZSAvUGFnZXMKPj4KZW5kb2JqCjkgMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggMTEwNAo+PgpzdHJlYW0KR2F0bTo/I3VIIidSZTwyXDFhNykpKV88MT01U2ZnLjtgTi1VJDUzV1tebz02IUsxX1RwPUZMKU9JdVloQ14xXWZIZ1tLQ0VwZEtuK0VjVy9HN2pwXSMmblJBIT4+YTEhNCtrQWkiaCdgYWNAKj8rPiJOYExBU0ZIZklCNXRUUFBhQVNaI2R1OjhcXkwyJi0uLmxfdDA7JzJjKVMmbjdwIz9qW3ErKklmLFVFOWdkP3JJSG1JJT5JKCVPMWUlQihvbE1iKENbTG0rRiZZISotc103OSRgLE5GdUE2ZkJPXVpeZmloPGUoZV11RGRyNlZrQEBdcUFfXisrMGVoTlImL1hjPGYvPkZDdUxSVnNwUz81LFQhLDJVQFJGIUNOQD9lRkpmWCZWW1RmVixncUE3KjomYUtMLkhMXnUtWCQiO3JCKzdwSU1GLy0ybC50bChPISVvPyREPlwsIVhAdFU5SG9UPztMZSR0V1dQXlFqVm85NDxkS0BZViwqZzNPI01qXE81QWdUcF8tbllUQzFVS2ojYWBsVjZ0Pyo7c1AzOG9oREkrJT8iOUpwMis3biIyaytAM0I6LFNlLSpaV2NyODRhIlsmQEVxIyFSI0laJGZtam1HaGM8OFcvRm11TldoaSFQLiYoZi0kZipeYEkpSEI9VSNOKjBVUmEuXDFgMW45QUouIjEnZSQ8TkYlKlFuWShXISYsS2xdZlVHT2IqKXBVKXAtSDE1Ik4pVjkkXjVbO3ImbU1AIU9DJGU2Vz87cihvS0wybUJJPVIhV1FjSj5sRW9OXzdjWEVob2thbjBsc0gjJy05OlR0TiQ9Zzg2QmRSP11UOyJMQ3NLXW9kZzNUITtfXG9uSVg/TSZgPTpEXyVWb21KSC80aGFkQ0lWayZkQV8ncCEkaDFKPi5SSWVyO00hbl0jQzM9b25zSSMwQGs+WyokQjEnL1ZVJHAzQFI8dGBPOz9OVlJhMDknYiVmOVVKcCYjWjMsQkZkTTxjKWJnTkYhOTI4JjBbbE1xQFYqRlNoPzJITClAW19WcShOTnNPQnInNDZpW1NOQUI3OHJDJV5TXkVbWE5SJyNvLm1nSUdzJGVIRFAyakQ+KFA2Z0VKbzVTVkBBLV9NbEtvLzNqYGYzVSQpWVphaWQ7LVUtaFQ+PUQ7SmNqTjc3JyxoSTojM0NfSXVMMDtRNyxPWUBTJyFZRjcwb100aDAyaHREIWhdSlFuTy5LWClkaGU6aSVsRm8uZ2FCVUd0UU1gb2BgWyNBK3BkQEBNL1NSa20lKC0+WU5iLVJRVi9IUklFWSRuI0tJbW0rPG5FNTdhKygwVjYqZ2NJODJbPVdVV0dUPyZsc1puJnBtZHQ9RVVvQkpmNFBUL1NdV1JcVXVTdHQ9YDBhMGUzYEVYYlNWRy4zJD9mLGw/OVJHbV1jaFY7c0ljbXUrSzAsIi9HcDtvW2ZjdS01NTY6L3UvLX4+ZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgMTAKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDAxMTIgMDAwMDAgbiAKMDAwMDAwMDIxOSAwMDAwMCBuIAowMDAwMDAwMzMxIDAwMDAwIG4gCjAwMDAwMDA0MTQgMDAwMDAgbiAKMDAwMDAwMDYxNyAwMDAwMCBuIAowMDAwMDAwNjg1IDAwMDAwIG4gCjAwMDAwMDA5NjUgMDAwMDAgbiAKMDAwMDAwMTAyNCAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9JRCAKWzw3ZjVhOGI1YzQxYWNlMGQzNjkyZWFhMmM4MWEyNjQ0Nj48N2Y1YThiNWM0MWFjZTBkMzY5MmVhYTJjODFhMjY0NDY+XQolIFJlcG9ydExhYiBnZW5lcmF0ZWQgUERGIGRvY3VtZW50IC0tIGRpZ2VzdCAob3BlbnNvdXJjZSkKCi9JbmZvIDcgMCBSCi9Sb290IDYgMCBSCi9TaXplIDEwCj4+CnN0YXJ0eHJlZgoyMjE5CiUlRU9GCg==',
      //   });

     // console.log('Email Attachments:', attachments);

      const emailMessage = {
        senderAddress: 'DoNotReply@4e025037-239a-4f46-88c6-0351eaf58bb5.azurecomm.net',
        content: {
          subject: emailSubject,
          plainText,
          html: htmlText,
        },
        recipients: { to: toRecipients },
        attachments: attachments,
      };

      const poller = await emailClient.beginSend(emailMessage);
      await poller.pollUntilDone();

      res.json({ success: true, message: `Email sent to ${toRecipients.length} recipient(s)` });

    } catch (emailError) {
      console.error('Email sending error:', emailError);
      res.status(500).json({ error: 'Failed to send email: ' + emailError.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function createSalesOrderPDFBuffer(order) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(globalThis.Buffer ? globalThis.Buffer.concat(chunks) : Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.image('./src/assets/aaruni.png', 50, 30, { width: 60, height: 30, align: 'right' });
      doc.fontSize(12).font('Helvetica-Bold').text(order.company?.name || 'Aaruni Lifesciences', 120, 40);
      doc.fontSize(9).font('Helvetica').text(order.company?.address || '', 50, 65);
      doc.fontSize(9).text(`Phone: ${order.salesOrder?.salesPerson?.phone || ''} | GSTIN: ${order.company?.gstin || ''}`, 50, 80);
      doc.fontSize(9).text(`CIN: ${order.company?.companyId || ''}`, 50, 95);

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#C0C0C0').text('SALES ORDER', 380, 40, {
        align: 'right',
        opacity: 0.1,
      });
      doc.fillColor('black');

      doc.moveDown(1);
      doc.moveTo(50, 110).lineTo(550, 110).stroke();
      doc.moveDown(0.5);

      const infoBoxLeft = 50;
      const infoBoxRight = 310;
      const infoBoxWidth = 240;
      const infoBoxHeight = 55;
      const infoBoxTop = 120;

      doc.rect(infoBoxLeft, infoBoxTop, infoBoxWidth, infoBoxHeight).stroke();
      doc.fontSize(9).font('Helvetica-Bold').text('ORDER DETAILS', infoBoxLeft + 8, infoBoxTop + 5, { width: infoBoxWidth - 16 });
      doc.fontSize(8).font('Helvetica');
      doc.text(`Order #: ${order.salesOrder?.salesOrderNumber || order.id}`, infoBoxLeft + 8, infoBoxTop + 20, { width: infoBoxWidth - 16 });
      doc.text(`Type: ${order.salesOrder?.orderType || ''} | Date: ${order.salesOrder?.salesOrderDate ? new Date(order.salesOrder.salesOrderDate).toLocaleDateString('en-IN') : ''}`, infoBoxLeft + 8, infoBoxTop + 33, { width: infoBoxWidth - 16 });
      doc.text(`Delivery: ${order.salesOrder?.deliveryDate ? new Date(order.salesOrder.deliveryDate).toLocaleDateString('en-IN') : ''}`, infoBoxLeft + 8, infoBoxTop + 43, { width: infoBoxWidth - 16 });

      doc.rect(infoBoxRight, infoBoxTop, infoBoxWidth, infoBoxHeight).stroke();
      doc.fontSize(9).font('Helvetica-Bold').text('REFERENCE', infoBoxRight + 8, infoBoxTop + 5, { width: infoBoxWidth - 16 });
      doc.fontSize(8).font('Helvetica');
      doc.text(`Reference: ${order.salesOrder?.reference || ''}`, infoBoxRight + 8, infoBoxTop + 20, { width: infoBoxWidth - 16 });
      doc.text(`Place of Supply: ${order.salesOrder?.placeOfSupply || ''}`, infoBoxRight + 8, infoBoxTop + 33, { width: infoBoxWidth - 16 });
      doc.text(`Sales Person: ${order.salesOrder?.salesPerson?.name || ''}`, infoBoxRight + 8, infoBoxTop + 43, { width: infoBoxWidth - 16 });

      doc.moveDown(1);

      const addressBoxWidth = 240;
      const addressBoxHeight = 95;
      const addressBoxY = doc.y;
      const addressBoxLeft = 50;
      const addressBoxRight = 310;

      doc.rect(addressBoxLeft, addressBoxY, addressBoxWidth, addressBoxHeight).stroke();
      doc.fontSize(10).font('Helvetica-Bold').text('BILL TO', addressBoxLeft + 8, addressBoxY + 5);
      doc.fontSize(9).font('Helvetica-Bold').text(order.customer?.billTo?.companyName || order.customer?.customerName || '', addressBoxLeft + 8, addressBoxY + 20, { width: addressBoxWidth - 16 });
      doc.fontSize(8).font('Helvetica');
      (order.customer?.billTo?.address || []).forEach((line, idx) => {
        doc.text(line, addressBoxLeft + 8, addressBoxY + 33 + idx * 10, { width: addressBoxWidth - 16 });
      });
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text(`Contact: ${order.customer?.customerName || ''}`, addressBoxLeft + 8, addressBoxY + 73, { width: addressBoxWidth - 16 });
      doc.fontSize(8).font('Helvetica');
      doc.text(`Email: ${order.customer?.email || ''}`, addressBoxLeft + 8, addressBoxY + 83, { width: addressBoxWidth - 16 });

      doc.rect(addressBoxRight, addressBoxY, addressBoxWidth, addressBoxHeight).stroke();
      doc.fontSize(10).font('Helvetica-Bold').text('SHIP TO', addressBoxRight + 8, addressBoxY + 5);
      doc.fontSize(9).font('Helvetica-Bold').text(order.customer?.shipTo?.companyName || '', addressBoxRight + 8, addressBoxY + 20, { width: addressBoxWidth - 16 });
      doc.fontSize(8).font('Helvetica');
      (order.customer?.shipTo?.address || []).forEach((line, idx) => {
        doc.text(line, addressBoxRight + 8, addressBoxY + 33 + idx * 10, { width: addressBoxWidth - 16 });
      });
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text(`Phone: ${order.customer?.phone || ''}`, addressBoxRight + 8, addressBoxY + 73, { width: addressBoxWidth - 16 });

      doc.moveDown(3);

      const tableTop = doc.y;
      const col1 = 50,
        col2 = 110,
        col3 = 240,
        col4 = 320,
        col5 = 390,
        col6 = 460;
      const rowHeight = 25;
      const pageWidth = 550;

      doc.rect(col1 - 5, tableTop, pageWidth - col1 + 5, rowHeight).fillAndStroke('#2c3e50', '#2c3e50');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('white');
      doc.text('Item Code', col1, tableTop + 4, { width: 50 });
      doc.text('Product', col2, tableTop + 4, { width: 120 });
      doc.text('Qty', col3, tableTop + 4, { width: 50, align: 'center' });
      doc.text('Unit Price (₹)', col4, tableTop + 4, { width: 60, align: 'right' });
      doc.text('Discount', col5, tableTop + 4, { width: 50, align: 'center' });
      doc.text('Total (₹)', col6, tableTop + 4, { width: 60, align: 'right' });

      doc.fillColor('black');
      let currentY = tableTop + rowHeight;
      let rowNum = 0;

      (order.items || []).forEach((item) => {
        if (rowNum % 2 === 0) {
          doc.rect(col1 - 5, currentY, pageWidth - col1 + 5, rowHeight).fill('#f5f5f5');
        }

        const productLabel = item.description || item.productName || '-';
        const unitDetails = item.unitMeasurements ? ` (${item.unitMeasurements})` : '';

        doc.fontSize(8).font('Helvetica').fillColor('black');
        doc.text(item.itemCode || '-', col1, currentY + 4, { width: 50 });
        doc.text(`${productLabel}${unitDetails}`, col2, currentY + 4, { width: 120 });
        doc.text(String(item.quantity || 0), col3, currentY + 4, { width: 50, align: 'center' });
        doc.text(`₹${Number(item.unitPrice || 0).toLocaleString('en-IN')}`, col4, currentY + 4, { width: 60, align: 'right' });
        doc.text(`${Number(item.discountPercent || 0)}%`, col5, currentY + 4, { width: 50, align: 'center' });
        doc.text(`₹${Number(item.lineTotal || 0).toLocaleString('en-IN')}`, col6, currentY + 4, { width: 60, align: 'right' });

        doc.moveTo(col1 - 5, currentY + rowHeight).lineTo(pageWidth, currentY + rowHeight).stroke();
        currentY += rowHeight;
        rowNum++;
      });

      doc.moveDown(1);
      const totalsX = 380;
      const totalsY = doc.y + 8;
      const taxRows = getSalesOrderTaxSummaryRows(order);

      doc.fontSize(9).font('Helvetica');
      doc.text('Subtotal:', totalsX, totalsY, { width: 80, align: 'right' });
      doc.text(`₹${Number(order.totals?.subTotal || 0).toLocaleString('en-IN')}`, totalsX + 85, totalsY, { width: 60, align: 'right' });
      taxRows.forEach((row, index) => {
        doc.text(`${row.label}:`, totalsX, totalsY + 15 + index * 15, { width: 80, align: 'right' });
        doc.text(`₹${Number(row.amount || 0).toLocaleString('en-IN')}`, totalsX + 85, totalsY + 15 + index * 15, { width: 60, align: 'right' });
      });

      const grandTotalBoxY = totalsY + 28 + ((taxRows.length - 1) * 15);
      doc.rect(totalsX - 5, grandTotalBoxY, 180, 22).fillAndStroke('#b8bab3', '#cae8d1');
      doc.fontSize(11).font('Helvetica-Bold').fillColor('white');
      doc.text('GRAND TOTAL:', totalsX + 2, grandTotalBoxY + 6, { width: 200, align: 'left' });
      doc.text(`₹${Number(order.totals?.grandTotal || 0).toLocaleString('en-IN')}`, totalsX + 84, grandTotalBoxY + 6, { width: 200, align: 'left' });

      doc.fillColor('black');
      doc.moveDown(1);

      doc.fontSize(8).font('Helvetica');
      doc.text(`Amount in Words: ${order.totals?.amountInWords || ''}`, 50, doc.y);
      doc.moveDown(1);

      doc.fontSize(10).font('Helvetica-Bold').text('Commercial Terms & Conditions', { underline: true });
      doc.fontSize(8).font('Helvetica');
      doc.text(`• Payment Terms: ${order.commercials?.paymentTerms || ''}`);
      doc.text(`• Delivery Schedule: ${order.commercials?.deliverySchedule || ''}`);
      doc.text(`• Shipping Charges: ${order.commercials?.shippingCharges || ''}`);
      doc.moveDown(0.5);

      const bankBoxTop = doc.y;
      doc.rect(50, bankBoxTop, 500, 70).stroke();
      doc.fontSize(10).font('Helvetica-Bold').text('Bank Details for Payment', 58, bankBoxTop + 5);
      doc.fontSize(8).font('Helvetica');
      const col1Bank = 58,
        col2Bank = 280;
      doc.text(`Account Name: ${order.bankDetails?.accountName || ''}`, col1Bank, bankBoxTop + 20);
      doc.text(`Account Number: ${order.bankDetails?.accountNumber || ''} | Bank Name: ${order.bankDetails?.bankName || ''}`, col1Bank, bankBoxTop + 33);
      doc.text(`GSTIN: ${order.company?.gstin || ''} | CIN: ${order.company?.companyId || ''}`, col1Bank, bankBoxTop + 46);
      doc.text(`Branch: ${order.bankDetails?.branchAddress || ''}`, col1Bank, bankBoxTop + 59);

      doc.moveDown(2);
      doc.moveTo(47, doc.y).lineTo(550, doc.y).stroke();
      doc.fontSize(8).font('Helvetica').text('Authorized Signatory', 50, doc.y + 10);
      doc.text(order.signature?.authorizedPerson || '', 50, doc.y + 20);
      doc.fontSize(7).font('Helvetica').fillColor('#666666');
      doc.text(`This sales order is generated on ${new Date().toLocaleDateString('en-IN')}. Terms and conditions apply.`, 50, doc.y + 35, { align: 'center' });
      doc.text(`Generated on ${new Date().toLocaleString('en-IN')} | Order ID: ${order.id}`, 50, doc.y + 10, { align: 'center' });
      doc.text('© ' + (order.company?.name || '') + ' - Confidential', 50, doc.y + 5, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

app.get('/api/sales-orders/:id/pdf', requireAuth, async (req, res) => {
  try {
    const orders = await readSalesOrders();
    const order = orders.find((q) => q.id === req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    const pdfBuffer = await createSalesOrderPDFBuffer(order);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="SalesOrder_${order.salesOrder?.salesOrderNumber || order.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Sales order PDF generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sales-orders/:id/send-email', requireAuth, async (req, res) => {
  try {
    const orders = await readSalesOrders();
    const order = orders.find((q) => q.id === req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    if (!emailClient) {
      return res.status(503).json({ error: 'Email service is not available' });
    }

    try {
      const data = req.body || {};
      if (!Array.isArray(data.recipients) || data.recipients.length === 0) {
        return res.status(400).json({ error: 'At least one recipient is required' });
      }

      const subject = data.subject || `Sales Order ${order.salesOrder?.salesOrderNumber || order.id}`;
      const message = data.message || '';
      const emailSubject = subject;
      const htmlText = generateSalesOrderEmailHTML(order, message);
      const plainText = generateSalesOrderPlainText(order, message);
      const toRecipients = data.recipients.map((email) => ({ address: String(email).trim() })).filter((r) => r.address);

      const pdfBuffer = await createSalesOrderPDFBuffer(order);
      const attachmentName = `SalesOrder_${order.salesOrder?.salesOrderNumber || order.id}.pdf`;
      const attachments = [
        {
          name: attachmentName,
          contentType: 'application/pdf',
          contentInBase64: pdfBuffer.toString('base64'),
        },
      ];

      if (Array.isArray(data.attachments)) {
        for (const a of data.attachments) {
          if (a && typeof a.name === 'string' && typeof a.contentInBase64 === 'string') {
            attachments.push({
              name: a.name,
              contentType: a.contentType,
              contentInBase64: a.contentInBase64,
            });
          }
        }
      }

      const emailMessage = {
        senderAddress: 'DoNotReply@4e025037-239a-4f46-88c6-0351eaf58bb5.azurecomm.net',
        content: {
          subject: emailSubject,
          plainText,
          html: htmlText,
        },
        recipients: { to: toRecipients },
        attachments,
      };

      const poller = await emailClient.beginSend(emailMessage);
      await poller.pollUntilDone();

      res.json({ success: true, message: `Email sent to ${toRecipients.length} recipient(s)` });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      res.status(500).json({ error: 'Failed to send email: ' + emailError.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const VERIFY_TOKEN = "satviansolutions"; // Create your own custom password string

// 1. GET Endpoint for Meta Verification
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('Webhook successfully verified by Meta!');
            return res.status(200).send(challenge);
        } else {
            return res.sendStatus(403);
        }
    }
});

// 2. POST Endpoint to Read Incoming Messages
app.post('/webhook', (req, res) => {
    const body = req.body;

    // Check if the webhook event is a WhatsApp message entry
    if (body.object === 'whatsapp_business_account') {
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            
            const messageData = body.entry[0].changes[0].value.messages[0];
            const fromNumber = messageData.from; // Sender phone number
            const messageType = messageData.type; // text, image, document etc.

            if (messageType === 'text') {
                const messageText = messageData.text.body;
                console.log(`New Message from ${fromNumber}: ${messageText}`);
                
                // INSERT CODE HERE TO SAVE THE MESSAGE TO YOUR DATABASE
            } else {
                console.log(`Received a non-text message of type: ${messageType}`);
            }
        }
        // Always return a 200 OK to Meta so they don't retry sending the same payload
        return res.status(200).send('EVENT_RECEIVED');
    } else {
        return res.sendStatus(404);
    }
});

function getSalesOrderTaxSummaryRows(order) {
  const gstPercentage = Number(order?.taxes?.gstPercentage || 18);
  const stateName = (order?.customer?.billTo?.state || order?.customer?.shipTo?.state || '').trim();
  const isKarnataka = stateName.toLowerCase() === 'karnataka';
  const gstAmount = Number(order?.totals?.gstAmount ?? order?.taxes?.gstAmount ?? 0);

  if (isKarnataka) {
    return [{ label: `GST (${gstPercentage}%)`, amount: gstAmount }];
  }

  const cgstAmount = Number(order?.totals?.cgstAmount ?? Math.round(gstAmount / 2));
  const sgstAmount = Number(order?.totals?.sgstAmount ?? gstAmount - cgstAmount);

  return [
    { label: 'CGST (9%)', amount: cgstAmount },
    { label: 'SGST (9%)', amount: sgstAmount },
  ];
}

function generateSalesOrderEmailHTML(order, customMessage = '') {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); padding: 30px; color: white; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .greeting { font-size: 16px; margin-bottom: 20px; }
        .message { background: #f9f9f9; padding: 15px; border-left: 4px solid #2c3e50; margin: 20px 0; border-radius: 4px; }
        .summary { background: #ecf7ed; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .summary-row { display: flex; justify-content: space-between; margin: 8px 0; }
        .summary-label { font-weight: 600; }
        .button { display: inline-block; background: #2c3e50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; }
        .company-info { font-size: 13px; margin-top: 15px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📄 Sales Order ${order.salesOrder?.salesOrderNumber || order.id}</h1>
            <p>From ${order.company?.name || ''}</p>
        </div>
        <div class="content">
            <div class="greeting">
                Dear ${order.customer?.customerName || 'Customer'},
            </div>
            <p>Thank you for your order. Please find the sales order acknowledgement attached for your reference.</p>
            ${customMessage ? `<div class="message">${customMessage}</div>` : ''}
            <div class="summary">
                <div class="summary-row"><span class="summary-label">Order Number:</span><span>${order.salesOrder?.salesOrderNumber || order.id}</span></div>
                <div class="summary-row"><span class="summary-label">Order Date:</span><span>${order.salesOrder?.salesOrderDate ? new Date(order.salesOrder.salesOrderDate).toLocaleDateString('en-IN') : ''}</span></div>
                <div class="summary-row"><span class="summary-label">Delivery Date:</span><span>${order.salesOrder?.deliveryDate ? new Date(order.salesOrder.deliveryDate).toLocaleDateString('en-IN') : ''}</span></div>
                <div class="summary-row"><span class="summary-label">Subtotal:</span><span>₹${Number(order.totals?.subTotal || 0).toLocaleString('en-IN')}</span></div>
                ${getSalesOrderTaxSummaryRows(order).map((row) => `
                <div class="summary-row"><span class="summary-label">${row.label}:</span><span>₹${Number(row.amount || 0).toLocaleString('en-IN')}</span></div>
                `).join('')}
                <div class="summary-row" style="border-top: 1px solid #ccc; padding-top: 8px; margin-top: 8px; font-weight: bold; font-size: 16px;"><span>Total Amount:</span><span>₹${Number(order.totals?.grandTotal || 0).toLocaleString('en-IN')}</span></div>
            </div>
            <p><strong>Items Summary:</strong></p>
            <table style="width: 100%; font-size: 13px; margin: 15px 0; border-collapse: collapse;">
                <tr style="background: #f5f5f5;"><th style="text-align: left; padding: 8px;">Product</th><th style="text-align: center; padding: 8px;">Qty</th><th style="text-align: right; padding: 8px;">Amount</th></tr>
                ${ (order.items || []).map((item) => `
                <tr><td style="padding: 8px;">${item.description || item.productName || '-'}</td><td style="text-align: center; padding: 8px;">${item.quantity || 0}</td><td style="text-align: right; padding: 8px;">₹${Number(item.lineTotal || 0).toLocaleString('en-IN')}</td></tr>
                `).join('') }
            </table>
            <p><strong>Payment Terms:</strong> ${order.commercials?.paymentTerms || ''}</p>
            <p><strong>Delivery Schedule:</strong> ${order.commercials?.deliverySchedule || ''}</p>
            <p>Please review the attached sales order acknowledgement. If you have any questions or require changes, let us know.</p>
            <p>Best regards,<br><strong>${order.salesOrder?.salesPerson?.name || ''}</strong><br>${order.company?.name || ''}<br>Phone: ${order.salesOrder?.salesPerson?.phone || ''}</p>
            <div class="company-info"><div>${order.company?.address || ''}</div><div>GSTIN: ${order.company?.gstin || ''}</div></div>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} ${order.company?.name || ''}. All rights reserved.</p>
            <p>This sales order acknowledgement is confidential and intended for the recipient only.</p>
        </div>
    </div>
</body>
</html>
  `;
}

function generateSalesOrderPlainText(order, customMessage = '') {
  return `
SALES ORDER ${order.salesOrder?.salesOrderNumber || order.id}
${'='.repeat(50)}

Dear ${order.customer?.customerName || 'Customer'},

Thank you for your order. Please find the attached sales order acknowledgement for your reference.

${customMessage ? customMessage + '\n\n' : ''}
ORDER DETAILS
Order Number: ${order.salesOrder?.salesOrderNumber || order.id}
Order Date: ${order.salesOrder?.salesOrderDate ? new Date(order.salesOrder.salesOrderDate).toLocaleDateString('en-IN') : ''}
Delivery Date: ${order.salesOrder?.deliveryDate ? new Date(order.salesOrder.deliveryDate).toLocaleDateString('en-IN') : ''}

ITEMS
${(order.items || []).map((item) => `${item.description || item.productName || '-'}${item.unitMeasurements ? ` (${item.unitMeasurements})` : ''}
  Quantity: ${item.quantity || 0}
  Unit Price: ₹${Number(item.unitPrice || 0).toLocaleString('en-IN')}
  Discount: ${Number(item.discountPercent || 0)}%
  Line Total: ₹${Number(item.lineTotal || 0).toLocaleString('en-IN')}`).join('\n\n')}

TOTALS
Subtotal: ₹${Number(order.totals?.subTotal || 0).toLocaleString('en-IN')}
${getSalesOrderTaxSummaryRows(order).map((row) => `${row.label}: ₹${Number(row.amount || 0).toLocaleString('en-IN')}`).join('\n')}
GRAND TOTAL: ₹${Number(order.totals?.grandTotal || 0).toLocaleString('en-IN')}

COMMERCIAL TERMS
Payment Terms: ${order.commercials?.paymentTerms || ''}
Delivery Schedule: ${order.commercials?.deliverySchedule || ''}
Shipping Charges: ${order.commercials?.shippingCharges || ''}

COMPANY INFORMATION
${order.company?.name || ''}
${order.company?.address || ''}
GSTIN: ${order.company?.gstin || ''}

Please review the attached sales order acknowledgement.

Best regards,
${order.salesOrder?.salesPerson?.name || ''}
Phone: ${order.salesOrder?.salesPerson?.phone || ''}

© ${new Date().getFullYear()} ${order.company?.name || ''}. All rights reserved.
`;
}

function getTaxSummaryRows(quote) {
  const gstPercentage = Number(quote?.taxes?.gstPercentage || 18);
  const stateName = (quote?.customer?.billTo?.state || quote?.customer?.shipTo?.state || '').trim();
  const isKarnataka = stateName.toLowerCase() === 'karnataka';
  const gstAmount = Number(quote?.totals?.gstAmount ?? quote?.taxes?.gstAmount ?? 0);

  if (isKarnataka) {
    return [{ label: `GST (${gstPercentage}%)`, amount: gstAmount }];
  }

  const cgstAmount = Number(quote?.totals?.cgstAmount ?? Math.round(gstAmount / 2));
  const sgstAmount = Number(quote?.totals?.sgstAmount ?? gstAmount - cgstAmount);

  return [
    { label: 'CGST (9%)', amount: cgstAmount },
    { label: 'SGST (9%)', amount: sgstAmount },
  ];
}

// Helper function to generate HTML email content
function generateQuotationEmailHTML(quote, customMessage = '') {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); padding: 30px; color: white; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .greeting { font-size: 16px; margin-bottom: 20px; }
        .message { background: #f9f9f9; padding: 15px; border-left: 4px solid #2c3e50; margin: 20px 0; border-radius: 4px; }
        .quote-summary { background: #ecf7ed; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .summary-row { display: flex; justify-content: space-between; margin: 8px 0; }
        .summary-label { font-weight: 600; }
        .button { display: inline-block; background: #2c3e50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; }
        .company-info { font-size: 13px; margin-top: 15px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📄 Quotation ${quote.quotation.quoteNumber}</h1>
            <p>From ${quote.company.name}</p>
        </div>
        <div class="content">
            <div class="greeting">
                Dear ${quote.customer.customerName},
            </div>
            <p>Thank you for your interest in our products and services. We are pleased to send you the quotation as requested.</p>
            
            ${customMessage ? `<div class="message">${customMessage}</div>` : ''}

            <div class="quote-summary">
                <div class="summary-row">
                    <span class="summary-label">Quote Number:</span>
                    <span>${quote.quotation.quoteNumber}</span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">Quote Date:</span>
                    <span>${new Date(quote.quotation.quotationDate).toLocaleDateString('en-IN')}</span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">Valid Until:</span>
                    <span>${new Date(quote.quotation.expiryDate).toLocaleDateString('en-IN')}</span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">Subtotal:</span>
                    <span>₹${quote.totals.subTotal.toLocaleString('en-IN')}</span>
                </div>
                ${getTaxSummaryRows(quote).map((row) => `
                <div class="summary-row">
                    <span class="summary-label">${row.label}:</span>
                    <span>₹${row.amount.toLocaleString('en-IN')}</span>
                </div>
                `).join('')}
                <div class="summary-row" style="border-top: 1px solid #ccc; padding-top: 8px; margin-top: 8px; font-weight: bold; font-size: 16px;">
                    <span>Total Amount:</span>
                    <span>₹${quote.totals.grandTotal.toLocaleString('en-IN')}</span>
                </div>
            </div>

            <p><strong>Items Summary:</strong></p>
            <table style="width: 100%; font-size: 13px; margin: 15px 0;">
                <tr style="background: #f5f5f5;">
                    <th style="text-align: left; padding: 8px;">Product</th>
                    <th style="text-align: center; padding: 8px;">Qty</th>
                    <th style="text-align: right; padding: 8px;">Amount</th>
                </tr>
                ${quote.items.map((item) => `<tr><td style="padding: 8px;">${item.description || item.productName || '-'}${item.unitMeasurements ? ` (${item.unitMeasurements})` : ''}</td><td style="text-align: center; padding: 8px;">${item.quantity}</td><td style="text-align: right; padding: 8px;">₹${item.lineTotal.toLocaleString('en-IN')}</td></tr>`).join('')}
            </table>

            <p><strong>Payment Terms:</strong> ${quote.commercials.paymentTerms}</p>
            <p><strong>Delivery Schedule:</strong> ${quote.commercials.deliverySchedule}</p>

            <p>Please review the attached quotation for detailed information and specifications. Should you have any questions or require further clarification, please don't hesitate to contact us.</p>

            <p>
                Best regards,<br>
                <strong>${quote.quotation.salesPerson.name}</strong><br>
                ${quote.company.name}<br>
                Phone: ${quote.quotation.salesPerson.phone}
            </p>

            <div class="company-info">
                <div>${quote.company.address}</div>
                <div>GSTIN: ${quote.company.gstin}</div>
            </div>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} ${quote.company.name}. All rights reserved.</p>
            <p>This quotation is confidential and intended for the use of the recipient only.</p>
        </div>
    </div>
</body>
</html>
  `;
}

// Helper function to generate plain text email
function generateQuotationPlainText(quote, customMessage = '') {
  return `
QUOTATION ${quote.quotation.quoteNumber}
${'='.repeat(50)}

Dear ${quote.customer.customerName},

Thank you for your interest in our products and services. We are pleased to send you the quotation as requested.

${customMessage ? customMessage + '\n' : ''}

QUOTATION DETAILS
Quote Number: ${quote.quotation.quoteNumber}
Quote Date: ${new Date(quote.quotation.quotationDate).toLocaleDateString('en-IN')}
Valid Until: ${new Date(quote.quotation.expiryDate).toLocaleDateString('en-IN')}

LINE ITEMS
${'='.repeat(50)}
${quote.items.map((item) => `${item.description || item.productName || '-'}${item.unitMeasurements ? ` (${item.unitMeasurements})` : ''}
  Quantity: ${item.quantity}
  Unit Price: ₹${item.unitPrice.toLocaleString('en-IN')}
  Discount: ${item.discountPercent}%
  Line Total: ₹${item.lineTotal.toLocaleString('en-IN')}`).join('\n\n')}

TOTALS
${'='.repeat(50)}
Subtotal: ₹${quote.totals.subTotal.toLocaleString('en-IN')}
${getTaxSummaryRows(quote).map((row) => `${row.label}: ₹${row.amount.toLocaleString('en-IN')}`).join('\n')}
GRAND TOTAL: ₹${quote.totals.grandTotal.toLocaleString('en-IN')}
In Words: ${quote.totals.amountInWords}

COMMERCIAL TERMS
Payment Terms: ${quote.commercials.paymentTerms}
Delivery Schedule: ${quote.commercials.deliverySchedule}
Shipping Charges: ${quote.commercials.shippingCharges}

COMPANY INFORMATION
${quote.company.name}
${quote.company.address}
GSTIN: ${quote.company.gstin}

Please review the attached quotation for detailed information and specifications. Should you have any questions or require further clarification, please don't hesitate to contact us.

Best regards,
${quote.quotation.salesPerson.name}
Phone: ${quote.quotation.salesPerson.phone}

© ${new Date().getFullYear()} ${quote.company.name}. All rights reserved.
This quotation is confidential and intended for the use of the recipient only.
  `;
}

app.use(express.static(CLIENT_BUILD_PATH));

app.get(/^(?!\/api).*/, (req, res) => {
  if (req.method !== 'GET') {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(CLIENT_BUILD_PATH, 'index.html'));
});

export default app;
