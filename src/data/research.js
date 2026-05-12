// src/data/research.js
// Edit this file to update the Research page.
// Images live in public/images/research/ — download from radlab.zone/images/research photos/ and place there.

export const labDescription = "The Regulatory and Affective Dynamics lab (RADlab) at the University of Toronto Mississauga was established in 2014 to investigate the complex interactions between emotion and cognition that determine subjective wellbeing and stress resilience. The RADlab's mission is to evaluate how individuals employ regulatory strategies in the face of stress, with an emphasis on evaluating the central theoretical claims underlying contemplative health promotion techniques such as mindfulness meditation and yoga.";

export const researchAreas = [
  {
    id: "wellness-buddy",
    title: "Wellness Buddy",
    image: "/images/research/wb.png",
    description: "Our project aims to develop a web application, guided by the Mindfulness-to-Meaning theory, designed to assess and enhance the wellbeing of post-secondary students. The \"Wellness Buddy\" platform encourages students to engage in regular self-reflective wellbeing check-ins, as our research suggests that these check-ins can lead to improved self-care planning and reduced stress reactions during high-pressure academic periods.",
    links: [
      { label: "Fiodorova & Farb (2022)", url: "https://doi.org/10.1080/10615806.2021.1949000" },
      { label: "Demo", url: "https://wellbeing-49fed.web.app/" },
    ],
  },
  {
    id: "chatbot-interventions",
    title: "Chatbot and Customized Interventions",
    image: "/images/research/chatbot.jpg",
    description: "This research project encompasses three key objectives: assessing the impact of various wellbeing intervention methods (check-ins, user-selected training materials, and a domain-specific chatbot) on participants' wellbeing outcomes; investigating the role of user engagement and autonomy in the effectiveness of mindfulness practices; and developing an interactive chatbot designed to personalize mindfulness techniques for specific life domains.",
    links: [
      { label: "Wang, Robertson, & Farb (in prep)", url: "https://osf.io/7a2bp/" },
      { label: "Wang & Farb (in prep)", url: "https://osf.io/hxdvf/" },
      { label: "Demo", url: "https://domainchatbot-a4a28.web.app/" },
    ],
  },
  {
    id: "neuroimaging-interoception",
    title: "Neuroimaging: Interoception",
    image: "/images/research/interoception.png",
    description: "Our neuroimaging work focuses on the neural underpinnings of identity and mental health. Currently we are exploring how attention to the breath (a form of interoception) changes brain activity relative to visual attention. We previously linked interoception to deactivation of diffuse cortical regions, with greater awareness linked to greater connectivity within attention networks. We are currently replicating this study with greater controls for physiological changes.",
    links: [
      { label: "Farb, Zuo, & Price (2023)", url: "https://doi.org/10.1523/ENEURO.0088-23.2023" },
    ],
  },
  {
    id: "neuroimaging-depression",
    title: "Neuroimaging: Depression Vulnerability",
    image: "/images/research/depression.png",
    description: "Recent work has demonstrated that sensory inhibition following negative mood challenge is a predictor of past, present, and future depression vulnerability. Rather than implying that depression is a product of overactive negative cognition, the inhibition of sensory activity — the ability to take in new information — during stress may be a more reliable indicator that someone has become 'stuck' in a depressive state.",
    links: [
      { label: "Farb, Desormeau, Anderson, & Segal (2022)", url: "https://doi.org/10.1016/j.nicl.2022.102969" },
    ],
  },
  {
    id: "machine-learning",
    title: "Machine Learning",
    image: "/images/research/machinelearning.png",
    description: "This project aims to objectively measure interoceptive sensibility using machine learning. We analyzed fMRI data from a randomized control trial involving interoceptive training. Our model effectively differentiated between interoceptive and exteroceptive attention within sessions (80% accuracy) and across new data (70% accuracy). This research demonstrates the neural distinction between interoceptive and exteroceptive attention, potentially offering an objective marker for interoceptive sensibility.",
    links: [
      { label: "Zuo, Price, & Farb (2023)", url: "https://doi.org/10.1111/ejn.16045" },
    ],
  },
  {
    id: "online-interventions",
    title: "Online Interventions",
    image: "/images/research/onlinetraining.png",
    description: "In this project, we explored web-based mental training interventions to support undergraduate students' wellbeing. Our main goal was to validate online training modules for decentering and reappraisal, key components of Mindfulness-to-Meaning Theory. We adapted these interventions for the web to assess their potential to improve students' mood, mental health, and coping skills, including a mindfulness-with-choice group enabling participants to select their preferred exercises.",
    links: [
      { label: "Wang & Farb (2023)", url: "https://doi.org/10.1080/10615806.2022.2079637" },
      { label: "Wang, Garland, & Farb (2023)", url: "https://psycnet.apa.org/doi/10.1037/emo0001252" },
    ],
  },
  {
    id: "mindful-game",
    title: "Mindful Game",
    image: "/images/research/mindful-adventure.jpg",
    description: "Our research project aims to harness the potential of online interventions and gamification techniques to bolster student mental health. Leveraging the proven benefits of mindfulness training, we seek to enhance mindful awareness, emotion regulation skills, happiness, and life satisfaction among students through engaging game-based experiences.",
    links: [
      { label: "Play: Mindful Adventure", url: "https://bb-nobunny.itch.io/mindfuladventure" },
    ],
  },
];
