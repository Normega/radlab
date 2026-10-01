// Public onboarding copy for /join/:slug, keyed by studies.open_join_slug.
// Every fact here must match the study's consent form (study_consent_forms) and
// its REB approval: payment, eligibility, time commitment, contact.

export const OPEN_JOIN_CONTENT = {
  habits: {
    eyebrow:     'RAD Lab · University of Toronto',
    title:       'Can small daily habits help with stress and mood?',
    lead:        'We are running a study to learn whether brief, daily online exercises can help students manage stress and support well-being.',
    contactName: 'Liliana Wu',
    contact:     'liliana.wu@mail.utoronto.ca',
    sections: [
      {
        heading: 'Who can take part',
        points: [
          'Current University of Toronto students who are experiencing moderate stress or low mood but are currently managing.',
          'You must use your U of T student email address (ending in @mail.utoronto.ca). Only student addresses are accepted: this keeps the study to U of T students and keeps out scams and spam.',
          'One sign-up per person. If you have already taken part in this study through SONA, you cannot take part again.',
        ],
      },
      {
        heading: 'What’s involved',
        points: [
          'First, a short set of questions to check whether the study is a good fit for you.',
          'The study runs for about a month, entirely online: a first session of about 30 minutes, a short daily exercise of about 4 minutes (a link is emailed to you each morning), and longer check-ins at the middle (about 20 minutes) and end (about 25 minutes).',
          'Under 3 hours in total, spread across the month.',
        ],
      },
      {
        heading: 'Payment',
        points: [
          '$18 per hour (Ontario minimum wage), up to $54 for the full study. If you stop early, you are paid for the parts you completed, rounded up to the nearest half hour.',
          'Payment is by Interac e-transfer to your U of T email address, within about 5 business days of finishing or withdrawing. You must be able to receive Interac e-transfers.',
        ],
      },
      {
        heading: 'Your privacy',
        points: [
          'The eligibility questions come first and ask for no name or email address.',
          'Only if you are eligible do we ask for your U of T email address. We send the link to start the study to that address.',
        ],
      },
    ],
  },
}
