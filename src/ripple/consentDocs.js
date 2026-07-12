// Versioned public-tier consent + terms-of-service copy for the /welcome flow.
// Bump a VERSION whenever its text changes in a way that requires re-agreement —
// the consents table stores (user_id, doc_type, version), so users who agreed to
// an older version can be re-prompted (spec §4.1 existing-user migration, §7).
//
// DRAFT STATUS: this copy is a working draft pending Norm + ethics review — the
// crisis-pathway launch gate (spec §5 guardrail 5, §11) covers final wording.

export const CONSENT_VERSION = '2026-07-12-draft'
export const TOS_VERSION     = '2026-07-12-draft'

export const CONSENT_DOC = {
  title: 'Research participation',
  paragraphs: [
    'RADlab (Regulatory and Affective Dynamics Lab, University of Toronto) runs this platform as both a wellbeing tool and a research instrument. By creating a public account you agree that the data you generate here may be used for research on wellbeing, attention, and emotion.',
    'What we collect: your gameplay data (scores, reaction times, ratings), your daily check-ins if you choose to do them, the demographic questions on the next screen, and basic account activity. We do not collect your browsing outside this site.',
    'How it is used: analyses are conducted on de-identified data. Published results only ever describe groups, never identifiable individuals. Group-level norms (for example, "how students are feeling this week") are computed only when enough people have contributed that no individual is discernible.',
    'Your choices: participation in any activity is voluntary. You can skip check-ins, disable your companion entirely in its settings, or stop using the platform at any time. You may request an export or deletion of your data by contacting the lab.',
    'This platform is not a clinical service. Check-ins are not monitored by a person, and nothing here diagnoses or treats any condition. If you are struggling, real support exists: Good2Talk (1-866-925-5454), the 9-8-8 Suicide Crisis Helpline (call or text 9-8-8), or your institution’s student support services.',
  ],
  checkboxLabel: 'I have read the above and agree that my platform data may be used for research as described.',
}

export const TOS_DOC = {
  title: 'Terms of use',
  paragraphs: [
    'Be 16 or older to create an account.',
    'Use the platform as yourself: one account per person, no automated play, no attempts to access other users’ data.',
    'Points, streaks, and unlockables are for engagement only — they have no monetary value and may be adjusted if we find bugs or abuse.',
    'We may update these terms; meaningful changes will be shown to you for re-agreement before they apply.',
    'The platform is provided as-is, without warranty. It is a research and wellbeing tool, not a medical device or clinical service.',
  ],
  checkboxLabel: 'I agree to these terms of use.',
}
