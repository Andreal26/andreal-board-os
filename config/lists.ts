/**
 * Dropdown values — carried over from the workbook's "Lists_Do_Not_Delete" tab, plus a few
 * lists the workbook was missing. Edit here and every form, filter and import validator follows.
 */
import type { Company, CompanyFilter } from '@/types';

export type { Company, CompanyFilter } from '@/types';
export const COMPANIES: readonly Company[] = ['Andreal', 'Anderson'];
export const COMPANY_FILTER: readonly CompanyFilter[] = ['All', 'Andreal', 'Anderson'];

export const LISTS = {
  RAG: ['Green', 'Amber', 'Red'],
  RiskLevel: ['Low', 'Medium', 'High', 'Critical'],
  YesNo: ['Yes', 'No'],
  DeliveryStatus: ['On Track', 'At Risk', 'Delayed', 'Delivered', 'Closed'],
  StageOps: ['Brief', 'Planning', 'Design', 'Content', 'Client Approval', 'Production', 'QC', 'Dispatch', 'Billing', 'Closed'],
  DelayReason: ['Client Delay', 'Internal Delay', 'Vendor Delay', 'Approval Delay', 'Material/Input Delay', 'Scope Change', 'No Delay'],
  BillingStatus: ['Not Billed', 'Part Billed', 'Fully Billed', 'On Hold'],
  SalesStage: ['New', 'Contacted', 'Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost', 'Dormant'],
  DealStatus: ['Open', 'Won', 'Lost', 'Dormant'],
  LeadQuality: ['Hot', 'Warm', 'Cold', 'Unqualified'],
  CampaignObjective: ['Awareness', 'Lead Generation', 'Conversion', 'Retargeting', 'Trust Building', 'Retention'],
  Channel: ['LinkedIn', 'Meta', 'Google', 'Email', 'WhatsApp', 'Website', 'Referral', 'Offline', 'Other'],
  LeadSource: ['Cold Call', 'Email', 'LinkedIn', 'Meta', 'Google', 'WhatsApp', 'Website', 'Employee Referral', 'External Referral', 'Existing Client', 'Offline', 'Other'],
  Segment: ['Education', 'Real Estate', 'Hospitality', 'MSME / Manufacturing', 'Corporate', 'Healthcare', 'Government / PSU', 'Other'],
  HRStatus: ['Active', 'Probation', 'Notice', 'Freelancer', 'Vendor', 'Exited'],
  Department: ['Design', 'Digital Marketing', 'Website', 'Immersive', 'Print / Production', 'Sales', 'Client Servicing', 'Accounts', 'HR / Admin', 'R&D', 'Management'],
  Priority: ['Low', 'Medium', 'High', 'Critical'],
  RnDStage: ['Idea', 'Research', 'Prototype', 'Testing', 'Client Pilot', 'Launch', 'Paused'],
  CategoryRnD: ['Product', 'Service', 'Process', 'Technology', 'Automation', 'IP', 'Training', 'Design', 'Video'],
  Feasibility: ['High', 'Medium', 'Low'],
  CashType: ['Collection', 'Payment', 'Transfer', 'Adjustment'],
  CashCategory: ['Client Receipt', 'Salary', 'Vendor', 'Statutory', 'EMI/Loan', 'Rent', 'Marketing', 'Utilities', 'Other'],
  MaterialReadiness: ['Ready', 'Partial', 'Not Ready', 'Not Applicable'],
  DispatchStatus: ['Not Started', 'Ready', 'Dispatched', 'Delivered', 'Not Applicable'],
} as const;

export type ListName = keyof typeof LISTS;

/** Default win probability by sales stage — used when Probability % is left blank. */
export const STAGE_PROBABILITY: Record<string, number> = {
  New: 10, Contacted: 20, Discovery: 30, Proposal: 50, Negotiation: 75, Won: 100, Lost: 0, Dormant: 5,
};
