import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmailClient } from '@azure/communication-email';

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
export const ENQUIRIES_FILE = path.join(__dirname, '..', 'data', 'enquiries.json');
export const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
export const PORT = Number(process.env.PORT) || 3001;
const CLIENT_BUILD_PATH = path.join(__dirname, '..', 'dist');

async function readJsonFile(filePath, writeEmpty) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      await writeEmpty([]);
      return [];
    }
    throw error;
  }
}

async function writeJsonFile(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

const readEnquiries = () => readJsonFile(ENQUIRIES_FILE, writeEnquiries);
const writeEnquiries = (data) => writeJsonFile(ENQUIRIES_FILE, data);
const readUsers = () => readJsonFile(USERS_FILE, writeUsers);
const writeUsers = (data) => writeJsonFile(USERS_FILE, data);
const ACCOUNTS_FILE = path.join(__dirname, '..', 'data', 'accounts.json');
const readAccounts = () => readJsonFile(ACCOUNTS_FILE, writeAccounts);
const writeAccounts = (data) => writeJsonFile(ACCOUNTS_FILE, data);
const CONTACTS_FILE = path.join(__dirname, '..', 'data', 'contacts.json');
const readContacts = () => readJsonFile(CONTACTS_FILE, writeContacts);
const writeContacts = (data) => writeJsonFile(CONTACTS_FILE, data);
const SALES_LEADS_FILE = path.join(__dirname, '..', 'data', 'salesLeads.json');
const readSalesLeads = () => readJsonFile(SALES_LEADS_FILE, writeSalesLeads);
const writeSalesLeads = (data) => writeJsonFile(SALES_LEADS_FILE, data);
const DEALS_FILE = path.join(__dirname, '..', 'data', 'deals.json');
const readDeals = () => readJsonFile(DEALS_FILE, writeDeals);
const writeDeals = (data) => writeJsonFile(DEALS_FILE, data);
const SALES_REGIONS_FILE = path.join(__dirname, '..', 'data', 'salesRegions.json');
const readSalesRegions = () => readJsonFile(SALES_REGIONS_FILE, writeSalesRegions);
const writeSalesRegions = (data) => writeJsonFile(SALES_REGIONS_FILE, data);
const LEAD_SOURCES_FILE = path.join(__dirname, '..', 'data', 'leadSources.json');
const readLeadSources = () => readJsonFile(LEAD_SOURCES_FILE, writeLeadSources);
const writeLeadSources = (data) => writeJsonFile(LEAD_SOURCES_FILE, data);
const EMAIL_GROUPS_FILE = path.join(__dirname, '..', 'data', 'emailGroups.json');
const readEmailGroups = () => readJsonFile(EMAIL_GROUPS_FILE, writeEmailGroups);
const writeEmailGroups = (data) => writeJsonFile(EMAIL_GROUPS_FILE, data);

const AZURE_EMAIL_CONNECTION_STRING = appSettings.azure?.email?.connectionString || '';
const AZURE_EMAIL_FROM_ADDRESS =
  process.env.AZURE_EMAIL_FROM_ADDRESS || appSettings.azure?.email?.fromAddress || 'no-reply@satvian.com';
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

async function sendLeadCreatedEmail(lead) {
  if (!emailClient) {
    return;
  }

  const recipients = await getLeadEmailRecipients(lead);
  if (!recipients.length) {
    return;
  }

  const subject = `New Sales Lead: ${lead.title} - ${lead.companyName}`;
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
      role: normalizedRole === 'admin' ? 'admin' : normalizedRole,
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
    phone: body.phone?.trim() || '',
    employees: body.employees?.trim() || '',
    annualRevenue: body.annualRevenue?.trim() || '',
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
    targetDealAmount: body.targetDealAmount?.trim() || '',
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
    dealAmount: body.dealAmount?.trim() || '',
    probability: Number(body.probability) || 0,
    expectedClosureDate: body.expectedClosureDate || '',
    competitor: body.competitor?.trim() || '',
    dealSource: body.dealSource?.trim() || '',
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
    leads: data.leads,
    createdBy: data.createdBy,
    createdDate: data.createdDate,
    updatedBy: data.updatedBy,
    updatedDate: data.updatedDate,
  };
}

function buildAccountRecord(data, existing = {}) {
  return {
    ...existing,
    companyName: data.companyName,
    address: data.address,
    city: data.city,
    state: data.state,
    country: data.country,
    pinZip: data.pinZip,
    industry: data.industry,
    website: data.website,
    phone: data.phone,
    employees: data.employees,
    annualRevenue: data.annualRevenue,
    region: data.region,
    status: data.status,
    health: data.health,
    owner: data.owner,
    startDate: data.startDate,
    gstNumber: data.gstNumber,
    description: data.description,
    notes: data.notes,
    tasks: data.tasks,
    leads: data.leads,
    contacts: data.contacts,
    deals: data.deals,
    createdBy: data.createdBy,
    createdDate: data.createdDate,
    updatedBy: data.updatedBy,
    updatedDate: data.updatedDate,
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
    return res.status(403).json({ error: 'Admin access required' });
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

    res.json(sanitizeUser(user));
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

    const enquiries = await readEnquiries();
    const newEnquiry = {
      id: Date.now(),
      ...buildEnquiryRecord(validation.data),
      createdAt: new Date().toISOString(),
    };
    enquiries.push(newEnquiry);
    await writeEnquiries(enquiries);
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
    enquiries[index] = updated;
    await writeEnquiries(enquiries);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/enquiries/:id', requireAuth, async (req, res) => {
  try {
    const enquiries = await readEnquiries();
    const next = enquiries.filter((e) => !matchId(e, req.params.id));
    if (next.length === enquiries.length) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }
    await writeEnquiries(next);
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
    const account = accounts.find((a) => matchId(a, req.params.id));
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

    const accounts = await readAccounts();
    const newAccount = {
      id: Date.now(),
      ...buildAccountRecord(validation.data),
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    accounts.push(newAccount);
    await writeAccounts(accounts);
    res.status(201).json(newAccount);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/accounts/:id', requireAuth, async (req, res) => {
  try {
    const accounts = await readAccounts();
    const index = accounts.findIndex((a) => matchId(a, req.params.id));
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
      updatedDate: new Date().toISOString(),
    };
    accounts[index] = updated;
    await writeAccounts(accounts);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/accounts/:id', requireAuth, async (req, res) => {
  try {
    const accounts = await readAccounts();
    const next = accounts.filter((a) => !matchId(a, req.params.id));
    if (next.length === accounts.length) {
      return res.status(404).json({ error: 'Account not found' });
    }
    await writeAccounts(next);
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

    const contacts = await readContacts();
    const newContact = {
      id: Date.now(),
      ...buildContactRecord(validation.data),
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    contacts.push(newContact);
    await writeContacts(contacts);
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
    contacts[index] = updated;
    await writeContacts(contacts);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/contacts/:id', requireAuth, async (req, res) => {
  try {
    const contacts = await readContacts();
    const next = contacts.filter((c) => !matchId(c, req.params.id));
    if (next.length === contacts.length) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    await writeContacts(next);
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

    const leads = await readSalesLeads();
    const newLead = {
      id: Date.now(),
      ...buildSalesLeadRecord(validation.data),
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    leads.push(newLead);
    await writeSalesLeads(leads);

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
    leads[index] = updated;
    await writeSalesLeads(leads);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/sales-leads/:id', requireAuth, async (req, res) => {
  try {
    const leads = await readSalesLeads();
    const next = leads.filter((l) => !matchId(l, req.params.id));
    if (next.length === leads.length) {
      return res.status(404).json({ error: 'Sales lead not found' });
    }
    await writeSalesLeads(next);
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

    const deals = await readDeals();
    const newDeal = {
      id: Date.now(),
      ...buildDealRecord(validation.data),
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    deals.push(newDeal);
    await writeDeals(deals);
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
    deals[index] = updated;
    await writeDeals(deals);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/deals/:id', requireAuth, async (req, res) => {
  try {
    const deals = await readDeals();
    const next = deals.filter((d) => !matchId(d, req.params.id));
    if (next.length === deals.length) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    await writeDeals(next);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const users = await readUsers();
    res.json(users.map(sanitizeUser));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sales-regions', requireAuth, requireAdmin, async (_req, res) => {
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

    const regions = await readSalesRegions();
    const newRegion = {
      id: Date.now(),
      ...buildSalesRegionRecord(validation.data),
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    regions.push(newRegion);
    await writeSalesRegions(regions);
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
    regions[index] = updated;
    await writeSalesRegions(regions);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/sales-regions/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const regions = await readSalesRegions();
    const next = regions.filter((r) => !matchId(r, req.params.id));
    if (next.length === regions.length) {
      return res.status(404).json({ error: 'Sales region not found' });
    }
    await writeSalesRegions(next);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/lead-sources', requireAuth, requireAdmin, async (_req, res) => {
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

    const sources = await readLeadSources();
    const newSource = {
      id: Date.now(),
      ...buildLeadSourceRecord(validation.data),
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    sources.push(newSource);
    await writeLeadSources(sources);
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
    sources[index] = updated;
    await writeLeadSources(sources);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/lead-sources/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const sources = await readLeadSources();
    const next = sources.filter((s) => !matchId(s, req.params.id));
    if (next.length === sources.length) {
      return res.status(404).json({ error: 'Lead source not found' });
    }
    await writeLeadSources(next);
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

    const groups = await readEmailGroups();
    const newGroup = {
      id: Date.now(),
      ...buildEmailGroupRecord(validation.data),
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };
    groups.push(newGroup);
    await writeEmailGroups(groups);
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
    groups[index] = updated;
    await writeEmailGroups(groups);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/email-groups/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const groups = await readEmailGroups();
    const next = groups.filter((g) => !matchId(g, req.params.id));
    if (next.length === groups.length) {
      return res.status(404).json({ error: 'Email group not found' });
    }
    await writeEmailGroups(next);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:id', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.authUser.role === 'admin';
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
    users.push(newUser);
    await writeUsers(users);
    res.status(201).json(sanitizeUser(newUser));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.authUser.role === 'admin';
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
      role: isAdmin ? data.role : users[index].role,
      phone: data.phone,
      updatedAt: new Date().toISOString(),
    };
    if (data.password) {
      updated.password = data.password;
    }

    users[index] = updated;
    await writeUsers(users);
    res.json(sanitizeUser(updated));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await readUsers();
    const next = users.filter((u) => !matchId(u, req.params.id));
    if (next.length === users.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    await writeUsers(next);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use(express.static(CLIENT_BUILD_PATH));

app.get(/^(?!\/api).*/, (req, res) => {
  if (req.method !== 'GET') {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(CLIENT_BUILD_PATH, 'index.html'));
});

export default app;
