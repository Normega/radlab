// Public onboarding copy for /join/:slug, keyed by studies.open_join_slug.
// Every fact here must match the study's consent form (study_consent_forms) and
// its REB approval: payment, eligibility, time commitment, contact.

export const OPEN_JOIN_CONTENT = {
  // UTMAP 2026, the third wave of the UTM campus wellbeing survey. Recruited at
  // a table on campus, so unlike `habits` this is a walk-up audience reading on
  // a phone in a concourse: the copy is short and the sections are the four
  // things someone decides on while standing up.
  //
  // PILOT. The study row is active = false and its consent form carries a pilot
  // banner. Both change only when the protocol is approved. Until then this
  // page is reachable but the open-join function will refuse to start a session,
  // which is the intended behaviour, not a bug.
  utmaps: {
    eyebrow:     'RAD Lab \u00b7 University of Toronto Mississauga',
    title:       'How are UTM students really doing?',
    lead:        'We have asked this every year since 2023. Last year most students told us things were getting worse. We want to know whether they are right.',
    // No screener on this study, so the button must not imply one. The
    // sections above promise there is nothing to screen for.
    cta:         'Start the survey',
    contactName: 'Dr. Norman Farb',
    contact:     'norman.farb@utoronto.ca',
    sections: [
      {
        heading: 'Who can take part',
        points: [
          'Current or recent University of Toronto Mississauga undergraduates, aged 17 or over.',
          'One sign-up per person.',
          'There is nothing to screen for. Taking part does not depend on how you are doing.',
        ],
      },
      {
        heading: 'What\u2019s involved',
        points: [
          'One questionnaire, about 8 minutes, on your own phone or a tablet at our table.',
          'Questions about your mood and wellbeing, your sources of stress, your physical and mental health, how you spend your time, and what you think other UTM students are going through.',
          'Every question is optional and you can stop at any point.',
          'Afterwards we ask for an email address. That is only so we can send one short follow-up of about two minutes a week later, which is also optional. You do not have to give an address.',
        ],
      },
      {
        heading: 'What you get',
        points: [
          'Pick a stress-relieving item from our table when you are done. You get it even if you start and decide to stop.',
          'If you want, we will email you the results when we publish them.',
        ],
      },
      {
        heading: 'Your privacy',
        points: [
          'Your answers carry no name. An email address is the only identifying thing we ever collect, and only if you choose the follow-up or ask for the results.',
          'Email addresses are stored separately from answers and deleted within 60 days.',
          'Nobody reads your answers as they arrive, and no answer leads to anyone contacting you.',
        ],
      },
    ],
  },
  // The Fall 2026 class trial, a teaching exercise rather than research:
  // students meet it in class after the midterm, with this page behind the QR
  // code and the course announcement. The three arms are deliberately not named
  // (they are revealed at the debrief). Every fact matches the consent form in
  // the trial's private repo (forms/consent.md).
  classtrial: {
    eyebrow:     'RAD Lab \u00b7 University of Toronto Mississauga',
    title:       'Our class trial: three daily practices for stress',
    lead:        'A small randomized controlled trial our class runs together, so you experience an RCT from the inside before we analyse one. A learning exercise, not research.',
    cta:         'Start',
    // the email step after Start (OpenEmailGate): no eligibility, no payment
    emailGate: {
      title:    'Where should your links go?',
      body:     'Enter your U of T student email address and we’ll send you the link to start. Each day’s practice will also go to this address.',
      sentLead: 'Thank you!',
      sentNext: 'Open it to read the consent form and, if you agree to take part, do the baseline survey (15 to 20 minutes).',
    },
    contactName: 'the teaching team',
    contact:     'psy240@radlab.zone',
    sections: [
      {
        heading: 'What\u2019s involved',
        points: [
          'Now: the consent form and a baseline survey, 15 to 20 minutes.',
          'From Saturday, October 17 to Friday, November 13: one email a day at 7 am with that day\u2019s practice, about five minutes. You\u2019ll be in one of three groups, chosen at random.',
          'November 14 to 16: a final survey, about 13 minutes. The results, and which group was which, in class on November 18.',
        ],
      },
      {
        heading: 'Your email',
        points: [
          'Use your U of T student email address (ending in @mail.utoronto.ca). Your link and the daily practices go there.',
          'One sign-up per person.',
        ],
      },
      {
        heading: 'Your choice',
        points: [
          'Taking part earns the participation credit. If you\u2019d rather not, or you stop at any point, the credit moves to a short written alternative. You don\u2019t need to give a reason.',
        ],
      },
      {
        heading: 'Your answers',
        points: [
          'Seen only as class summaries, never individually, and deleted by January 31, 2027.',
          'Nobody reads your answers as they arrive, and no answer leads to anyone contacting you.',
        ],
      },
    ],
  },
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
          'To continue past the first 12 days, you need to complete at least 10 of the 12 daily sessions and the midpoint check-in (open for 3 days). If you don’t, your participation ends there and you are paid for what you completed.',
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
