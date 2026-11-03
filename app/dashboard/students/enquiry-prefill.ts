// The hand-off from an enquiry to the Add Student form: the Inquiries page saves
// this for one page load and the Students page opens the form with it.
export const ENQUIRY_PREFILL_KEY = 'mila_enquiry_prefill'

export interface EnquiryPrefill {
  inquiryId: string
  /** the person who filled in the enquiry form (usually the parent) */
  contactName: string
  email: string
  phone: string
  academy: 'MFA' | 'MBA'
  childAge: number | null
  message: string
}
