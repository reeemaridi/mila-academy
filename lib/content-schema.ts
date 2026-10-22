// Every editable piece of text and imagery on the public site.
//
// One list drives three things:
//   - the public pages read these keys (with `default` as the fallback), via
//     getSiteContent() in lib/site-data.ts
//   - the dashboard's Site Content editor renders one input per field
//   - the settings API only accepts keys that appear here
//
// Values are stored as rows in the `site_settings` table (key → value). A key
// with no row shows its default, so adding a field here needs no migration.
//
// To make a new piece of the site editable: add a field below, then read
// `content.<key>` in the component instead of the hardcoded string.

export type FieldType = 'text' | 'textarea' | 'image' | 'url' | 'email' | 'tel'

export interface ContentField {
  key: string
  label: string
  type: FieldType
  default: string
  help?: string
}

export interface ContentSection {
  id: string
  title: string
  description: string
  fields: readonly ContentField[]
}

// Generic so each field keeps its literal key — that is what makes
// `content.football_name` type-checked instead of an arbitrary string lookup.
const f = <K extends string>(key: K, label: string, type: FieldType, def: string, help?: string) =>
  ({ key, label, type, default: def, help })

function academySection<S extends 'football' | 'basketball'>(sport: S) {
  const fb = sport === 'football'
  return {
    id: sport,
    title: fb ? 'Football Academy' : 'Basketball Academy',
    description: `Name, branding and the /${sport} page. The name and logo are also used on the homepage, footer and enquiry form.`,
    fields: [
      f(`${sport}_name`,     'Academy name',   'text', fb ? 'Mila Football Academy' : 'Mila Basket Academy'),
      f(`${sport}_short`,    'Short name',     'text', fb ? 'MFA' : 'MBA', 'Used in buttons like "Ready to join MFA?"'),
      f(`${sport}_tagline`,  'Tagline',        'text', fb ? 'Football training in Baissour' : 'Basketball training in Baissour'),
      f(`${sport}_est`,      'Established line', 'text', fb ? 'Est. 2016 · Baissour, Lebanon' : 'Est. 2024 · Baissour, Lebanon'),
      f(`${sport}_logo`,     'Logo',           'image', fb ? '/logos/mfa_navbar.png' : '/logos/mba_navbar.png'),
      f(`${sport}_ball_image`, 'Homepage ball image', 'image',
        fb ? '/logos/football-ball-soccer-svgrepo-com.svg' : '/logos/ball-of-basketball-svgrepo-com.svg',
        'The spinning ball on the homepage. Square images work best.'),
      f(`${sport}_hero_image`, 'Page banner photo', 'image', '',
        'Optional background photo behind the top of the academy page. Leave empty for the coloured backdrop.'),
      f(`${sport}_cta_title`, 'Bottom call-to-action title', 'text', fb ? 'Ready to join MFA?' : 'Ready to join MBA?'),
      f(`${sport}_cta_text`,  'Bottom call-to-action text', 'textarea',
        'Reach out and our team will help you choose the right program and get started.'),
      f(`${sport}_seo_title`, 'Browser tab / search title', 'text', fb ? 'Mila Football Academy' : 'Mila Basket Academy'),
      f(`${sport}_seo_description`, 'Search description', 'textarea', fb
        ? 'Youth football training in Baissour, Lebanon since 2016 — programmes for every age and level, from beginner to pro pathway.'
        : 'Youth basketball training in Baissour, Lebanon — programmes for every age and level, from beginner to pro pathway.'),
    ],
  } as const
}

export const CONTENT_SECTIONS = [
  {
    id: 'general',
    title: 'General',
    description: 'Site name, search-engine text and the icon shown in the browser tab.',
    fields: [
      f('brand_name',       'Brand name (navbar)',        'text', 'MILA ACADEMY'),
      f('site_title',       'Homepage title',             'text', 'Mila Academy', 'Shown in the browser tab and in search results.'),
      f('site_description', 'Homepage search description', 'textarea',
        'Mila Football Academy & Mila Basket Academy — Train with the best in Lebanon.'),
      f('share_image',      'Link preview image',         'image', '/logos/mfa_hq_transparent.png',
        'Shown when the site is shared on WhatsApp, Facebook, etc.'),
      f('favicon',          'Browser tab icon',           'image', '/logos/mfa_favicon.png', 'A small square PNG works best.'),
    ],
  },
  {
    id: 'contact_details',
    title: 'Contact Details & Social Links',
    description: 'Shown in the Contact section, the footer and the WhatsApp buttons. Empty fields are hidden on the site.',
    fields: [
      f('phone_display',   'Phone (as displayed)', 'tel',   '+961 70 000 000'),
      f('whatsapp_number', 'WhatsApp number',      'tel',   '96170000000',
        'Digits only, with country code and no + or spaces — e.g. 96170123456.'),
      f('email',           'Email',                'email', 'info@milaacademy.com'),
      f('location',        'Location',             'text',  'Baissour, Lebanon'),
      f('hours',           'Training hours',       'text',  'Mon – Sat  4PM – 8PM'),
      f('instagram_url',   'Instagram link',       'url',   '', 'Full link, e.g. https://instagram.com/yourpage. Leave empty to hide.'),
      f('facebook_url',    'Facebook link',        'url',   ''),
      f('youtube_url',     'YouTube link',         'url',   ''),
    ],
  },
  {
    id: 'navigation',
    title: 'Navigation',
    description: 'Menu labels in the top bar and the footer.',
    fields: [
      f('nav_home',     'Home',            'text', 'Home'),
      f('nav_about',    'About',           'text', 'About'),
      f('nav_programs', 'Programs',        'text', 'Programs'),
      f('nav_gallery',  'Gallery',         'text', 'Gallery'),
      f('nav_contact',  'Contact',         'text', 'Contact'),
      f('nav_enroll',   'Enroll button',   'text', 'Enroll Now'),
    ],
  },
  {
    id: 'hero',
    title: 'Homepage Top',
    description: 'The split football / basketball screen visitors see first. Names, logos and ball images come from the academy sections below.',
    fields: [
      f('hero_enter_label', 'Enter button', 'text', 'Enter →'),
    ],
  },
  {
    id: 'about',
    title: 'About / Numbers',
    description: 'The "By The Numbers" section. A figure left empty or set to 0 is hidden.',
    fields: [
      f('about_eyebrow',    'Small heading',  'text', 'Mila Academy'),
      f('about_title',      'Heading',        'text', 'The academy in numbers'),
      f('players_trained',  'Figure 1',       'text', '500+', 'A number, optionally followed by a symbol like + or %.'),
      f('stat1_label',      'Figure 1 label', 'text', 'Players Trained'),
      f('years_excellence', 'Figure 2',       'text', '8'),
      f('stat2_label',      'Figure 2 label', 'text', 'Years of Excellence'),
      f('academies_count',  'Figure 3',       'text', '2'),
      f('stat3_label',      'Figure 3 label', 'text', 'Academies'),
      f('success_rate',     'Figure 4',       'text', ''),
      f('stat4_label',      'Figure 4 label', 'text', 'Success Rate'),
      f('about_quote',      'Quote',          'textarea', 'We coach young players in Baissour, two sports, one standard: show up, work hard, play fair.'),
    ],
  },
  {
    id: 'programs_section',
    title: 'Programs Section',
    description: 'Headings around the program cards. The programs themselves are edited under Website → Programs.',
    fields: [
      f('programs_title',          'Homepage heading',        'text', 'Our Programs'),
      f('programs_subtitle',       'Homepage subheading',     'text', 'Choose your path'),
      f('programs_enroll_label',   'Card button',             'text', 'Enroll Now'),
      f('academy_programs_title',  'Academy page heading',    'text', 'Our Programs'),
      f('academy_programs_hint',   'Academy page subheading', 'text', 'pick the right team', 'Shown after the program count, e.g. "11 programs · pick the right team".'),
      f('academy_view_programs',   'Academy page "View Programs" button', 'text', 'View Programs'),
      f('academy_enroll_label',    'Academy page "Enroll" button', 'text', 'Enroll Now →'),
      f('whatsapp_label',          'WhatsApp buttons',        'text', 'Chat on WhatsApp'),
    ],
  },
  {
    id: 'gallery_testimonials',
    title: 'Gallery & Testimonials',
    description: 'Section headings. Photos and testimonials themselves have their own pages under Website.',
    fields: [
      f('gallery_title',      'Gallery heading',      'text', 'Our Academy in Action'),
      f('testimonials_title', 'Testimonials heading', 'text', 'What Families Say'),
    ],
  },
  {
    id: 'contact_section',
    title: 'Enquiry Form',
    description: 'The sign-up form in the Contact section. Submissions appear under Website → Inquiries.',
    fields: [
      f('contact_title',   'Heading',               'text', 'Join Mila Academy'),
      f('contact_submit',  'Submit button',         'text', 'Enroll Now'),
      f('contact_success', 'Message after sending', 'text', "✓  Enrolled! We'll contact you soon"),
      f('contact_error',   'Message if sending fails', 'text', 'Something went wrong sending your request — please try WhatsApp instead.'),
      f('contact_follow',  'Social links heading',  'text', 'Follow Us'),
    ],
  },
  {
    id: 'footer',
    title: 'Footer',
    description: 'The bottom of every page.',
    fields: [
      f('footer_tagline',   'Tagline',          'textarea',
        'Train with the best in Lebanon.\nDeveloping the next generation of athletes since 2016.', 'Line breaks are kept.'),
      f('footer_copyright', 'Copyright name',   'text', 'Mila Academy. All rights reserved.', 'Shown after "© <year>".'),
      f('footer_note',      'Bottom note',      'text', 'Built with passion · Lebanon'),
      f('footer_staff_login', 'Log-in link',      'text', 'Log In'),
    ],
  },
  academySection('football'),
  academySection('basketball'),
] as const satisfies readonly ContentSection[]

type Sections = typeof CONTENT_SECTIONS
export type ContentKey = Sections[number]['fields'][number]['key']
export type SiteContent = Record<ContentKey, string>

export const CONTENT_FIELDS: readonly ContentField[] = CONTENT_SECTIONS.flatMap(s => s.fields as readonly ContentField[])

export const CONTENT_KEYS: ReadonlySet<string> = new Set(CONTENT_FIELDS.map(fl => fl.key))

export const CONTENT_DEFAULTS = Object.fromEntries(
  CONTENT_FIELDS.map(fl => [fl.key, fl.default]),
) as SiteContent

/** Longest value accepted for a field, by type. */
export function maxLengthFor(type: FieldType): number {
  return type === 'textarea' ? 2000 : type === 'image' || type === 'url' ? 1000 : 300
}
