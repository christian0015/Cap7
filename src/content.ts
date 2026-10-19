// src/content.ts
// ★ Tout le contenu éditable : marque, prix, examens, grilles, sujets, pays, FAQ, pages légales, tirages de départ.
// Les sujets sont ORIGINAUX : aucun sujet réel d'examen. Les chiffres d'examen sont vérifiés ou marqués dans le README.

import { SKILLS, SKILL_LABEL, nclcTableRows, firstLangPoints, secondLangPoints } from "./crs.ts";
import type { Exam, Skill } from "./crs.ts";

/* ================= Marque, éditeur, offres ================= */

export const BRAND = {
  name: "Cap7", // variable unique (alternatives si le domaine est pris : Nclc7, Franco7)
  tagline: "Visez NCLC 7. Sachez ce que ça vous rapporte.",
  description:
    "Préparation au TCF Canada et au TEF Canada : correction IA de l’expression écrite et orale, séries de compréhension, plan de travail et lien direct avec les points CRS de l’Entrée express.",
};

/** À compléter par l’éditeur avant la mise en production (voir README, actions humaines). */
export const PUBLISHER = {
  legalName: "À COMPLÉTER : nom de l’éditeur (personne physique ou société)",
  address: "À COMPLÉTER : adresse postale de l’éditeur",
  country: "Maroc",
  hosting: "Vercel Inc. (hébergement) et MongoDB Atlas (base de données)",
};

export function contactEmail(siteUrl: string): string {
  try {
    return `support@${new URL(siteUrl).hostname.replace(/^www\./, "")}`;
  } catch {
    return "support@exemple.com";
  }
}

export type PlanId = "p30" | "p90";

export const PLANS: Record<PlanId, { id: PlanId; name: string; price: number; days: number; corrections: number; featured: boolean }> = {
  p30: { id: "p30", name: "Pass 30 jours", price: 14.99, days: 30, corrections: 40, featured: false },
  p90: { id: "p90", name: "Pass 90 jours", price: 29.99, days: 90, corrections: 150, featured: true },
};

export const LIMITS = {
  dailyCorrections: 8,
  dailyComprehensionSeries: 30,
  maxChars: 4000,
  maxAudioSeconds: 240,
  maxAudioBytes: 8 * 1024 * 1024,
  freeAccountsPerIp30d: 3,
  referralBonusCorrections: 1,
  seriesSize: 10,
};

export const FREE_FEATURES = [
  "Calculateur de points CRS et suivi des tirages",
  "1 correction écrite et 1 correction orale",
  "1 série de compréhension écrite et 1 série de compréhension orale",
];

export const PAID_FEATURES = [
  "Corrections IA de l’écrit et de l’oral, avec fourchette NCLC et erreurs expliquées",
  "Séries de compréhension écrite et orale (usage raisonnable : 30 par jour)",
  "Plan de travail jusqu’à votre date d’examen, progression par critère",
  "Paiement unique, sans abonnement",
];

export const REFUND_POLICY =
  "Pas de remboursement après la première correction payante : le niveau gratuit vous permet d’essayer le service avant d’acheter. Le prestataire de paiement applique les droits légaux de rétractation qui s’imposent.";

/* ================= Examens ================= */

export interface TaskDef {
  id: string;
  label: string;
  minWords?: number;
  maxWords?: number;
  minutes: number;
  brief: string;
}

export interface ExamInfo {
  id: Exam;
  name: string;
  owner: string;
  validityYears: number;
  durations: Record<Skill, string>;
  writing: TaskDef[];
  speaking: TaskDef[];
  officialUrl: string;
  formatNote: string;
}

export const EXAMS: Record<Exam, ExamInfo> = {
  tcf: {
    id: "tcf",
    name: "TCF Canada",
    owner: "France Éducation international",
    validityYears: 2,
    durations: {
      CO: "35 minutes",
      CE: "60 minutes",
      EE: "60 minutes (3 tâches)",
      EO: "12 minutes dont 2 minutes de préparation (3 tâches, face à un examinateur)",
    },
    writing: [
      { id: "t1", label: "Tâche 1", minWords: 60, maxWords: 120, minutes: 15, brief: "Un message pour décrire, raconter ou expliquer une situation." },
      { id: "t2", label: "Tâche 2", minWords: 120, maxWords: 150, minutes: 20, brief: "Un courrier, une note ou un article qui rend compte d’une situation à des destinataires précis." },
      { id: "t3", label: "Tâche 3", minWords: 120, maxWords: 180, minutes: 25, brief: "Deux opinions s’opposent : présentez-les avec vos mots (40 à 60 mots), puis donnez votre position (80 à 120 mots)." },
    ],
    speaking: [
      { id: "t1", label: "Tâche 1 : entretien dirigé", minutes: 2, brief: "Parler de vous, sans préparation." },
      { id: "t2", label: "Tâche 2 : exercice en interaction", minutes: 5.5, brief: "Obtenir des informations dans une situation courante (2 minutes de préparation). Ici, vous dites vos répliques à voix haute." },
      { id: "t3", label: "Tâche 3 : point de vue", minutes: 4.5, brief: "Exprimer et défendre un point de vue, sans préparation." },
    ],
    officialUrl: "https://www.france-education-international.fr/test/tcf-canada",
    formatNote: "Durées et nombres de mots : page officielle de France Éducation international, vérifiée le 17 octobre 2026.",
  },
  tef: {
    id: "tef",
    name: "TEF Canada",
    owner: "CCI Paris Île-de-France",
    validityYears: 2,
    durations: {
      CO: "40 minutes (60 questions)",
      CE: "60 minutes (50 questions)",
      EE: "60 minutes (2 sections, 25 puis 35 minutes)",
      EO: "15 minutes (2 jeux de rôle face à un examinateur : 5 puis 10 minutes)",
    },
    writing: [
      { id: "a", label: "Section A : suite d’un fait divers", minWords: 80, minutes: 25, brief: "Écrire la suite d’un court fait divers (80 mots au minimum)." },
      { id: "b", label: "Section B : lettre d’opinion", minWords: 200, minutes: 35, brief: "Exprimer et argumenter une opinion dans une lettre (200 mots au minimum)." },
    ],
    speaking: [
      { id: "a", label: "Section A : poser des questions", minutes: 5, brief: "Jeu de rôle en situation formelle : obtenir des informations à partir d’une annonce. Ici, vous dites vos questions à voix haute." },
      { id: "b", label: "Section B : convaincre", minutes: 10, brief: "Jeu de rôle en situation amicale : convaincre un ami. Votre enregistrement ici est limité à 4 minutes." },
    ],
    officialUrl: "https://www.lefrancaisdesaffaires.fr/tests-diplomes/test-evaluation-francais-tef/tef-canada/",
    formatNote: "Durées, nombres de mots et sections : descriptif et exemples de sujets de la CCI Paris Île-de-France (Le français des affaires), vérifiés le 18 octobre 2026.",
  },
};

export const EXAM_LIST: Exam[] = ["tcf", "tef"];

export function isExam(x: string): x is Exam {
  return x === "tcf" || x === "tef";
}

/* ================= Critères de correction ================= */

export const WRITTEN_CRITERIA = [
  { id: "adequation", label: "Adéquation à la tâche" },
  { id: "coherence", label: "Cohérence et organisation" },
  { id: "lexique", label: "Lexique" },
  { id: "grammaire", label: "Grammaire et orthographe" },
] as const;

export const ORAL_CRITERIA = [...WRITTEN_CRITERIA, { id: "fluidite", label: "Fluidité" }] as const;

export const ERROR_TYPES = ["accord", "conjugaison", "syntaxe", "lexique", "orthographe", "registre", "connecteurs"] as const;

/** Faiblesses étiquetées (utilisées par le plan de travail déterministe). */
export const WEAKNESS_LABEL: Record<string, string> = {
  accord: "Accords (genre, nombre)",
  conjugaison: "Conjugaison et temps",
  syntaxe: "Construction des phrases",
  lexique: "Richesse du vocabulaire",
  orthographe: "Orthographe",
  registre: "Registre de langue",
  connecteurs: "Connecteurs logiques",
  argumentation: "Argumentation",
  coherence: "Cohérence du texte",
  fluidite: "Fluidité à l’oral",
  adequation: "Respect de la consigne",
  grammaire: "Grammaire",
};

/* ================= Tirages de départ ================= */

export interface DrawSeed {
  date: string; // AAAA-MM-JJ
  category: "french" | "cec";
  invitations: number;
  crs: number;
}

/** Tirages français 2026 et tirages CEC récents, tous vérifiés le 18/10/2026 contre le flux officiel d'IRCC (ee_rounds_123_en.json). */
export const DRAWS_SEED: DrawSeed[] = [
  { date: "2026-02-06", category: "french", invitations: 8500, crs: 400 },
  { date: "2026-03-04", category: "french", invitations: 5500, crs: 397 },
  { date: "2026-03-18", category: "french", invitations: 4000, crs: 393 },
  { date: "2026-04-15", category: "french", invitations: 4000, crs: 419 },
  { date: "2026-04-29", category: "french", invitations: 4000, crs: 400 },
  { date: "2026-05-28", category: "french", invitations: 4500, crs: 409 },
  { date: "2026-07-09", category: "french", invitations: 5000, crs: 420 },
  { date: "2026-07-22", category: "french", invitations: 5000, crs: 399 },
  { date: "2026-08-06", category: "french", invitations: 5000, crs: 391 },
  { date: "2026-08-19", category: "french", invitations: 5000, crs: 382 },
  { date: "2026-10-16", category: "french", invitations: 5000, crs: 435 },
  { date: "2026-08-05", category: "cec", invitations: 3000, crs: 516 },
  { date: "2026-10-15", category: "cec", invitations: 2500, crs: 519 },
];

export function frenchSeedStats() {
  const f = DRAWS_SEED.filter((d) => d.category === "french");
  return {
    count: f.length,
    min: Math.min(...f.map((d) => d.crs)),
    max: Math.max(...f.map((d) => d.crs)),
    total: f.reduce((s, d) => s + d.invitations, 0),
  };
}

/* ================= Sujets d’expression (originaux) ================= */

export interface Topic {
  id: string;
  theme: string;
  weakness: string;
  text: string;
}

type Raw = [theme: string, weakness: string, text: string];

const RAW: Record<string, Raw[]> = {
  "tcf-ecrit-t1": [
    ["logement", "registre", "Annoncez à un ami que vous déménagez et invitez-le à votre pendaison de crémaillère (date, lieu, ce qu’il peut apporter)."],
    ["voisinage", "conjugaison", "Écrivez à votre voisin pour vous excuser d’un bruit pendant la nuit et expliquez ce qui s’est passé."],
    ["transport", "conjugaison", "Racontez par message à un collègue la panne qui a perturbé votre trajet ce matin."],
    ["loisirs", "connecteurs", "Informez votre groupe d’amis que la sortie au parc est reportée et proposez une nouvelle date."],
    ["logement", "lexique", "Décrivez à un ami le petit appartement que vous visitez demain et demandez son avis."],
    ["études", "registre", "Envoyez un message à la bibliothèque pour demander la prolongation d’un livre emprunté."],
    ["famille", "lexique", "Décrivez à votre cousine le repas que vous avez préparé pour la fête de famille."],
    ["logement", "syntaxe", "Écrivez à votre colocataire pour répartir les tâches ménagères de la semaine."],
    ["santé", "conjugaison", "Racontez à une amie votre première journée dans une nouvelle salle de sport."],
    ["études", "registre", "Prévenez votre professeur de votre absence à un cours et demandez comment rattraper la séance."],
    ["ville", "accord", "Annoncez à des amis que vous avez trouvé un chat perdu et décrivez-le pour retrouver son propriétaire."],
    ["culture", "lexique", "Conseillez à un ami un film vu hier sans en révéler la fin."],
  ],
  "tcf-ecrit-t2": [
    ["ville", "coherence", "Vous organisez la fête de quartier : rédigez un article pour le journal du quartier (programme, horaires, inscription)."],
    ["logement", "registre", "Écrivez un courriel à votre propriétaire pour signaler une fuite d’eau, expliquer les dégâts et demander une intervention."],
    ["travail", "connecteurs", "Rédigez un compte rendu pour votre équipe après une réunion dont vous étiez le secrétaire."],
    ["loisirs", "lexique", "Vous revenez d’un séjour de bénévolat : écrivez un article pour le blog de l’association."],
    ["transport", "argumentation", "Écrivez à la mairie pour proposer une piste cyclable dans votre rue et expliquez vos raisons."],
    ["travail", "registre", "Rédigez une note pour vos collègues qui présente le nouveau règlement de la cafétéria."],
    ["ville", "conjugaison", "Racontez dans un courriel à un ami une panne d’électricité pendant un orage et comment vous vous êtes organisé."],
    ["consommation", "registre", "Écrivez à un magasin pour réclamer un produit défectueux livré en retard et demander une solution."],
    ["études", "accord", "Rédigez un article pour le journal de votre école sur un événement sportif auquel vous avez assisté."],
    ["études", "syntaxe", "Écrivez aux parents d’élèves pour annoncer une sortie scolaire (lieu, coût, autorisation)."],
    ["voisinage", "coherence", "Rédigez un courriel à un voisin absent pour résumer ce qui s’est passé dans l’immeuble cette semaine."],
    ["travail", "connecteurs", "Écrivez à votre responsable pour résumer l’avancement d’un projet et demander un délai supplémentaire."],
  ],
  "tcf-ecrit-t3": [
    ["travail", "argumentation", "Télétravail. Avis A : « Travailler chez soi améliore la qualité de vie. » Avis B : « Le bureau reste indispensable à la cohésion d’une équipe. »"],
    ["ville", "connecteurs", "Voiture en ville. Avis A : « Il faut interdire les voitures dans les centres-villes. » Avis B : « Pour beaucoup de familles, la voiture reste nécessaire. »"],
    ["technologie", "coherence", "Réseaux sociaux. Avis A : « Ils rapprochent les gens. » Avis B : « Ils isolent et rendent dépendant. »"],
    ["études", "argumentation", "Cours à distance. Avis A : « Étudier en ligne donne plus de liberté. » Avis B : « Rien ne remplace la présence en classe. »"],
    ["études", "connecteurs", "Uniforme scolaire. Avis A : « L’uniforme réduit les inégalités entre élèves. » Avis B : « L’uniforme limite l’expression personnelle. »"],
    ["consommation", "argumentation", "Produits locaux. Avis A : « Acheter local devrait être la règle. » Avis B : « Le choix mondial profite aux consommateurs. »"],
    ["travail", "coherence", "Semaine de quatre jours. Avis A : « Elle rend les employés plus efficaces. » Avis B : « Elle désorganise les entreprises. »"],
    ["loisirs", "connecteurs", "Tourisme. Avis A : « Voyager loin est indispensable pour s’ouvrir au monde. » Avis B : « Découvrir sa propre région suffit largement. »"],
    ["technologie", "argumentation", "Apprentissage des langues. Avis A : « Les applications suffisent pour progresser. » Avis B : « Il faut des cours avec un enseignant. »"],
    ["culture", "coherence", "Lecture. Avis A : « Le livre papier est irremplaçable. » Avis B : « La lecture numérique est plus pratique et plus écologique. »"],
    ["travail", "argumentation", "Choix d’un métier. Avis A : « Un bon salaire passe avant tout. » Avis B : « L’intérêt du travail compte davantage que l’argent. »"],
    ["ville", "connecteurs", "Lieu de vie. Avis A : « La vie à la campagne est plus saine. » Avis B : « La ville offre bien plus d’occasions de s’épanouir. »"],
  ],
  "tef-ecrit-a": [
    ["ville", "conjugaison", "Un cycliste a retrouvé un sac contenant des documents importants devant la gare. Écrivez la suite de l’article."],
    ["ville", "coherence", "Une boulangerie de quartier a distribué gratuitement tout son pain après une coupure d’électricité. Imaginez la suite."],
    ["transport", "conjugaison", "Un autobus scolaire est resté bloqué une heure sous la neige. Racontez comment la situation s’est terminée."],
    ["loisirs", "syntaxe", "Un randonneur égaré a été retrouvé au lever du jour grâce à des habitants. Écrivez la suite du récit."],
    ["voisinage", "connecteurs", "Les habitants d’un immeuble ont découvert une fuite qui menaçait le sous-sol. Poursuivez l’article."],
    ["études", "conjugaison", "Un élève a rapporté à son école un portefeuille trouvé dans la cour. Écrivez ce qui s’est passé ensuite."],
    ["culture", "lexique", "Un concert en plein air a dû être interrompu par un orage. Racontez la suite pour le journal local."],
    ["santé", "accord", "Un passant a porté secours à une personne qui s’était évanouie sur le marché. Écrivez la suite."],
    ["ville", "lexique", "Un chat est resté coincé sur un toit pendant deux jours. Imaginez le dénouement."],
    ["travail", "syntaxe", "Une usine a évacué ses employés à cause d’une alarme incendie. Poursuivez le récit."],
    ["consommation", "coherence", "Un client a reçu par erreur un colis destiné à un voisin. Écrivez la suite de l’histoire."],
    ["loisirs", "conjugaison", "Une course populaire a changé de parcours à la dernière minute. Racontez la suite."],
  ],
  "tef-ecrit-b": [
    ["travail", "argumentation", "Un article affirme que le télétravail devrait être obligatoire deux jours par semaine. Écrivez une lettre au journal pour défendre votre opinion."],
    ["ville", "argumentation", "Un maire veut fermer le centre-ville aux voitures. Écrivez une lettre au journal pour donner et justifier votre avis."],
    ["technologie", "coherence", "Un article propose d’interdire le téléphone portable à l’école. Écrivez une lettre au journal pour exprimer votre position."],
    ["environnement", "connecteurs", "Un journal propose de taxer fortement les emballages plastiques. Écrivez une lettre pour dire si vous êtes d’accord."],
    ["études", "argumentation", "Un article soutient que les devoirs à la maison devraient disparaître. Écrivez une lettre au journal pour expliquer votre point de vue."],
    ["santé", "registre", "Une chronique recommande de rendre le sport obligatoire au travail. Rédigez une lettre pour donner votre avis."],
    ["consommation", "connecteurs", "Un journal propose de fermer les magasins le dimanche. Écrivez une lettre pour exprimer votre opinion."],
    ["culture", "coherence", "Un article estime que les musées devraient être gratuits pour tous. Écrivez une lettre pour défendre ou critiquer cette idée."],
    ["ville", "registre", "Un quartier veut remplacer un parking par un jardin partagé. Écrivez une lettre au journal pour soutenir ou refuser le projet."],
    ["travail", "argumentation", "Un article défend la semaine de quatre jours. Écrivez une lettre pour dire ce que vous en pensez."],
    ["environnement", "coherence", "Une ville veut interdire les voyages en avion de courte distance. Écrivez une lettre pour donner et argumenter votre avis."],
    ["famille", "connecteurs", "Un journal affirme que les enfants devraient apprendre une troisième langue dès l’école primaire. Écrivez une lettre pour répondre."],
  ],
  "tcf-oral-t1": [
    ["famille", "fluidite", "Présentez-vous : votre prénom, votre famille, ce que vous aimez faire ensemble."],
    ["travail", "lexique", "Parlez de votre travail ou de vos études : ce que vous faites et ce qui vous plaît."],
    ["ville", "fluidite", "Décrivez la ville où vous habitez et dites ce que vous y appréciez."],
    ["loisirs", "conjugaison", "Parlez de vos loisirs de la semaine dernière."],
    ["cuisine", "lexique", "Parlez de ce que vous mangez pendant une journée ordinaire."],
    ["routine", "conjugaison", "Décrivez votre journée type, du réveil au coucher."],
    ["voyage", "conjugaison", "Racontez un voyage qui vous a marqué."],
    ["langues", "fluidite", "Parlez des langues que vous connaissez et de la façon dont vous les avez apprises."],
    ["amitié", "lexique", "Présentez un ami proche et expliquez pourquoi vous vous entendez bien."],
    ["projets", "syntaxe", "Parlez de vos projets pour l’année qui vient."],
    ["souvenirs", "conjugaison", "Racontez un souvenir d’enfance dont vous vous rappelez bien."],
    ["quartier", "lexique", "Parlez de votre quartier : les commerces, les transports, l’ambiance."],
  ],
  "tcf-oral-t2": [
    ["loisirs", "registre", "Vous téléphonez à une salle de sport pour vous renseigner (horaires, tarifs, essai gratuit). Posez vos questions à voix haute."],
    ["études", "registre", "Vous contactez une école de cuisine pour obtenir des informations sur un cours du soir. Posez vos questions."],
    ["logement", "syntaxe", "Vous appelez pour louer une salle pour une fête de famille. Posez toutes les questions utiles."],
    ["consommation", "registre", "Vous vous renseignez sur un abonnement internet pour votre appartement. Posez vos questions."],
    ["logement", "lexique", "Vous demandez des informations à une entreprise de déménagement (date, prix, assurance)."],
    ["famille", "registre", "Vous cherchez une place en garderie pour votre enfant. Posez vos questions à la responsable."],
    ["études", "syntaxe", "Vous vous renseignez sur une formation de soir en informatique (durée, coût, inscription)."],
    ["transport", "lexique", "Vous téléphonez à un magasin pour louer des vélos pour une journée (tarifs, casque, caution)."],
    ["culture", "registre", "Vous demandez des informations sur une visite guidée de la ville (horaires, durée, langues)."],
    ["banque", "registre", "Vous contactez une banque pour ouvrir un compte (documents, frais, carte)."],
    ["études", "syntaxe", "Vous appelez la bibliothèque pour savoir comment vous inscrire et emprunter des livres."],
    ["santé", "registre", "Vous téléphonez à une clinique pour prendre un rendez-vous et demander ce qu’il faut apporter."],
  ],
  "tcf-oral-t3": [
    ["famille", "argumentation", "Les enfants devraient-ils avoir un téléphone avant douze ans ? Donnez votre point de vue."],
    ["travail", "argumentation", "Vaut-il mieux travailler dans une petite entreprise ou dans une grande ? Expliquez votre choix."],
    ["technologie", "coherence", "Les réseaux sociaux améliorent-ils nos relations ? Défendez votre opinion."],
    ["environnement", "argumentation", "Chacun peut-il vraiment agir pour l’environnement ? Donnez votre avis."],
    ["études", "coherence", "Faut-il choisir ses études selon les débouchés ou selon ses goûts ?"],
    ["ville", "argumentation", "Est-il préférable de vivre en ville ou à la campagne ? Justifiez votre réponse."],
    ["santé", "coherence", "Le sport devrait-il être obligatoire à l’école tous les jours ?"],
    ["consommation", "argumentation", "Faut-il réparer les objets plutôt que d’en acheter de nouveaux ?"],
    ["culture", "coherence", "La lecture a-t-elle encore sa place à l’époque des vidéos ?"],
    ["travail", "argumentation", "Un bon salaire suffit-il pour être heureux au travail ?"],
    ["voyage", "coherence", "Voyager seul ou en groupe : qu’est-ce qui vous semble le mieux ?"],
    ["langues", "argumentation", "Pourquoi est-il utile de parler plusieurs langues aujourd’hui ?"],
  ],
  "tef-oral-a": [
    ["logement", "registre", "Annonce : « Studio meublé près du métro, 650 $ par mois, chauffage inclus, libre en janvier. » Vous appelez pour obtenir des précisions."],
    ["loisirs", "lexique", "Annonce : « Cours de peinture le samedi matin, groupes de huit personnes, matériel fourni. » Posez vos questions."],
    ["travail", "registre", "Annonce : « Café du centre-ville cherche serveur à temps partiel, soirs et fins de semaine. » Renseignez-vous sur le poste."],
    ["transport", "syntaxe", "Annonce : « Vente de vélo électrique, très bon état, deux ans d’âge. » Posez vos questions au vendeur."],
    ["études", "registre", "Annonce : « Cours de français du soir, deux fois par semaine, niveau intermédiaire. » Obtenez les informations utiles."],
    ["famille", "lexique", "Annonce : « Garde d’enfants le mercredi après-midi dans le quartier. » Posez vos questions à la personne."],
    ["loisirs", "syntaxe", "Annonce : « Séjour de ski d’un week-end, transport et hébergement inclus. » Demandez des précisions."],
    ["consommation", "registre", "Annonce : « Canapé presque neuf à vendre, déménagement obligé. » Posez vos questions."],
    ["santé", "lexique", "Annonce : « Séances de yoga en plein air tous les dimanches. » Renseignez-vous sur le groupe."],
    ["culture", "registre", "Annonce : « Atelier d’écriture pour adultes, un soir par semaine. » Posez vos questions à l’animateur."],
    ["ville", "syntaxe", "Annonce : « Recherche colocataire pour grand appartement lumineux au centre. » Demandez des détails."],
    ["travail", "lexique", "Annonce : « Formation courte en secourisme au travail, certificat à la fin. » Posez vos questions."],
  ],
  "tef-oral-b": [
    ["voyage", "argumentation", "Convainquez un ami de partir une semaine avec vous dans un pays que vous aimez."],
    ["santé", "argumentation", "Convainquez un ami de s’inscrire avec vous à un club de course à pied."],
    ["études", "coherence", "Convainquez un ami de reprendre ses études à temps partiel."],
    ["environnement", "argumentation", "Convainquez un ami de renoncer à sa voiture pour aller au travail."],
    ["culture", "coherence", "Convainquez un ami de venir avec vous à un festival de musique."],
    ["logement", "argumentation", "Convainquez un ami de prendre une colocation plutôt qu’un appartement seul."],
    ["travail", "coherence", "Convainquez un ami de postuler à un emploi dans une autre ville."],
    ["loisirs", "argumentation", "Convainquez un ami d’apprendre à jouer d’un instrument de musique."],
    ["consommation", "coherence", "Convainquez un ami d’acheter des vêtements d’occasion plutôt que neufs."],
    ["famille", "argumentation", "Convainquez un ami de passer plus de temps en famille le week-end."],
    ["langues", "coherence", "Convainquez un ami d’apprendre une langue étrangère avec vous."],
    ["ville", "argumentation", "Convainquez un ami de s’impliquer dans un projet de jardin partagé du quartier."],
  ],
};

export type Mode = "ecrit" | "oral";

export function topicsFor(exam: Exam, mode: Mode, task: string): Topic[] {
  const raw = RAW[`${exam}-${mode}-${task}`] ?? [];
  return raw.map(([theme, weakness, text], i) => ({ id: `${exam}-${mode}-${task}-${i + 1}`, theme, weakness, text }));
}

export function findTopic(id: string): (Topic & { exam: Exam; mode: Mode; task: string }) | null {
  const m = id.match(/^(tcf|tef)-(ecrit|oral)-([a-z0-9]+)-(\d+)$/);
  if (!m) return null;
  const list = topicsFor(m[1] as Exam, m[2] as Mode, m[3]);
  const t = list.find((x) => x.id === id);
  return t ? { ...t, exam: m[1] as Exam, mode: m[2] as Mode, task: m[3] } : null;
}

export function tasksFor(exam: Exam, mode: Mode): TaskDef[] {
  return mode === "ecrit" ? EXAMS[exam].writing : EXAMS[exam].speaking;
}

export function allTopicCount(): number {
  return Object.values(RAW).reduce((s, a) => s + a.length, 0);
}

/* ================= FAQ ================= */

export const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Qu’est-ce que le NCLC ?",
    a: "Le NCLC (Niveaux de compétence linguistique canadiens) est l’échelle officielle canadienne pour le français, de 1 à 12. Pour l’Entrée express, IRCC convertit vos résultats de TCF Canada ou de TEF Canada en niveaux NCLC, compétence par compétence : compréhension orale, compréhension écrite, expression écrite et expression orale.",
  },
  {
    q: "Quelle est la différence entre le TEF Canada et le TCF Canada ?",
    a: "Les deux tests sont acceptés par IRCC pour l’Entrée express et valables deux ans. Ils n’ont pas le même format : le TCF Canada comporte trois tâches écrites courtes et un oral en trois tâches, le TEF Canada deux sections écrites plus longues et un oral en deux sections. Chacun a sa propre table de conversion vers le NCLC. Choisissez celui dont le format vous convient et dont les centres d’examen sont accessibles pour vous.",
  },
  {
    q: "Combien de temps mes résultats sont-ils valables ?",
    a: "Deux ans à compter de la date du test pour les programmes de l’Entrée express. Vérifiez toujours la date limite avant de créer ou de mettre à jour votre profil.",
  },
  {
    q: "Comment fonctionne l’estimation de Cap7 ?",
    a: "Pour l’écrit et l’oral, un correcteur automatique applique un barème approximatif, non officiel, et donne une fourchette de niveaux NCLC (jamais un chiffre unique). En cas d’hésitation il retient le niveau le plus bas. Pour la compréhension, le niveau est estimé à partir de vos résultats sur des séries de dix questions, à partir d’au moins six questions par niveau. Ces estimations sont indicatives.",
  },
  {
    q: "Qu’est-ce que Cap7 ne mesure pas ?",
    a: "Cap7 n’évalue pas la prononciation, ne simule pas un dialogue en temps réel avec un examinateur, et les enregistrements des séries de compréhension orale sont produits par synthèse vocale, sans bruits ni accents réels. Cap7 ne remplace pas un test officiel et ne promet ni score, ni réussite, ni invitation à présenter une demande.",
  },
];

/* ================= Pays ================= */

export interface Country {
  slug: string;
  name: string;
  status: string;
  vigilance: string;
  advice: string;
}

export const COUNTRIES: Country[] = [
  {
    slug: "maroc", name: "le Maroc",
    status: "Le français n’est pas langue officielle au Maroc, où l’arabe et l’amazighe le sont, mais il est très présent dans l’enseignement supérieur, l’administration, l’économie et les médias.",
    vigilance: "Les candidats qui ont grandi avec l’arabe dialectal ou l’amazighe confondent parfois certaines prépositions, hésitent sur le genre de certains noms et écrivent avec un registre trop proche de l’oral.",
    advice: "Si vous parlez couramment le français au quotidien, votre point faible est souvent l’écrit formel : soignez les connecteurs, la ponctuation et les accords, plutôt que la compréhension.",
  },
  {
    slug: "algerie", name: "l’Algérie",
    status: "Le français n’est pas langue officielle en Algérie, mais il reste très répandu dans les études supérieures, l’administration et la vie professionnelle.",
    vigilance: "L’alternance entre plusieurs langues à l’oral, courante dans la vie quotidienne, peut glisser dans les productions écrites et orales de l’examen sous forme de tournures calquées ou de mots empruntés.",
    advice: "Entraînez-vous à produire un français uniforme, sans mélange de langues, et à rester dans un registre soutenu pendant toute la durée de l’épreuve orale.",
  },
  {
    slug: "tunisie", name: "la Tunisie",
    status: "L’arabe est la langue officielle de la Tunisie ; le français y est enseigné dès l’école primaire et très utilisé dans les études, les affaires et les médias.",
    vigilance: "Les erreurs fréquemment observées chez les francophones de contexte maghrébin touchent les prépositions, certains accords et le choix des temps du passé.",
    advice: "Travaillez le passé composé et l’imparfait en alternance, car les tâches de récit sont très présentes dans les deux examens.",
  },
  {
    slug: "senegal", name: "le Sénégal",
    status: "Le français est la langue officielle du Sénégal, aux côtés de langues nationales très parlées comme le wolof.",
    vigilance: "Le français parlé au quotidien comporte des expressions locales qui ne sont pas toujours comprises par un évaluateur ; à l’écrit, elles peuvent passer pour des erreurs de vocabulaire.",
    advice: "Gardez le français standard pour l’examen et enrichissez votre lexique abstrait (argumenter, nuancer, conclure), souvent décisif pour passer de NCLC 6 à NCLC 7.",
  },
  {
    slug: "cote-d-ivoire", name: "la Côte d’Ivoire",
    status: "Le français est la langue officielle de la Côte d’Ivoire et sert de langue commune entre de nombreuses communautés linguistiques.",
    vigilance: "Le français ivoirien oral comporte des tournures et un vocabulaire familiers, qu’il faut savoir mettre de côté pour une épreuve écrite ou un entretien formel.",
    advice: "Alternez des exercices de registre formel et familier : réécrivez un message informel en lettre soignée pour vous habituer à changer de ton.",
  },
  {
    slug: "cameroun", name: "le Cameroun",
    status: "Le Cameroun a deux langues officielles, le français et l’anglais, ce qui place beaucoup de candidats dans un contexte bilingue.",
    vigilance: "Le bilinguisme peut produire des faux amis entre l’anglais et le français (par exemple pour certains verbes et prépositions) et des tournures calquées sur l’anglais.",
    advice: "Faites la liste de vos faux amis personnels et révisez-la avant chaque production écrite ; c’est un gain rapide en précision lexicale.",
  },
  {
    slug: "rdc", name: "la République démocratique du Congo",
    status: "Le français est la langue officielle de la République démocratique du Congo, à côté de quatre langues nationales largement parlées.",
    vigilance: "Selon la langue de la maison, certains candidats hésitent sur les accords, la construction des phrases longues et l’emploi des articles.",
    advice: "Privilégiez des phrases courtes, correctes et bien liées plutôt que de longues phrases risquées : la clarté rapporte plus de points que la complexité mal maîtrisée.",
  },
  {
    slug: "haiti", name: "Haïti",
    status: "Le français et le créole haïtien sont les deux langues officielles d’Haïti ; le créole est la langue maternelle de la grande majorité de la population.",
    vigilance: "Les interférences du créole portent souvent sur le genre grammatical, l’usage des articles et l’accord des verbes, notamment à l’écrit.",
    advice: "Consacrez du temps aux accords sujet-verbe et à l’accord de l’adjectif ; la relecture ciblée des terminaisons est très rentable dans l’expression écrite.",
  },
  {
    slug: "france", name: "la France",
    status: "Le français est la langue maternelle de la plupart des candidats qui résident en France, mais le niveau NCLC ne reflète pas l’aisance orale : il mesure des tâches précises et un écrit normé.",
    vigilance: "Les francophones natifs perdent souvent des points sur l’orthographe grammaticale, le respect strict de la consigne et le nombre de mots exigé.",
    advice: "Ne comptez pas sur votre aisance : entraînez-vous aux tâches de l’examen, chronométrées, et comptez vos mots à chaque essai.",
  },
  {
    slug: "belgique", name: "la Belgique",
    status: "Le français est l’une des trois langues officielles de la Belgique et la langue de l’enseignement en Wallonie et à Bruxelles.",
    vigilance: "Quelques belgicismes lexicaux, comme les numéraux « septante » et « nonante », sont compris mais peuvent surprendre ; le registre et la précision comptent davantage que la variété utilisée.",
    advice: "Visez un français standard pour l’épreuve et concentrez-vous sur la structure des textes argumentatifs, qui reste la compétence à travailler en priorité.",
  },
  {
    slug: "liban", name: "le Liban",
    status: "L’arabe est la langue officielle du Liban ; le français est très présent dans l’éducation et la vie sociale.",
    vigilance: "Le passage fréquent entre l’arabe, le français et l’anglais peut entraîner des mélanges de langues et des emprunts à l’écrit comme à l’oral.",
    advice: "Pratiquez l’oral en français continu, sans changer de langue, par exemple en vous enregistrant trois minutes sur un sujet imposé.",
  },
  {
    slug: "guinee", name: "la Guinée",
    status: "Le français est la langue officielle de la Guinée et la langue de l’école, aux côtés de plusieurs langues nationales.",
    vigilance: "La formation initiale peut avoir laissé des lacunes sur les temps composés et sur la construction de la subordination.",
    advice: "Construisez vos textes avec trois ou quatre connecteurs sûrs (d’abord, de plus, cependant, en conclusion) et réutilisez-les : c’est une base fiable pour atteindre NCLC 7.",
  },
  {
    slug: "mali", name: "le Mali",
    status: "Le français est la langue officielle du Mali, utilisée dans l’administration et l’enseignement à côté des langues nationales.",
    vigilance: "Les candidats multilingues peuvent hésiter sur le choix des temps verbaux et sur la précision du vocabulaire abstrait.",
    advice: "Alimentez un carnet de vocabulaire par thème (travail, santé, logement, études) : les sujets des deux examens reviennent toujours à ces domaines.",
  },
  {
    slug: "benin", name: "le Bénin",
    status: "Le français est la langue officielle du Bénin et la langue de l’enseignement, dans un pays où plusieurs langues nationales sont parlées.",
    vigilance: "Les écarts observés touchent surtout la ponctuation, les accords du participe passé et l’emploi de certaines prépositions.",
    advice: "Faites relire vos textes par un tiers ou par le correcteur de Cap7 et notez chaque erreur répétée : trois erreurs récurrentes corrigées valent souvent un niveau.",
  },
  {
    slug: "inde", name: "l’Inde",
    status: "En Inde, le français est une langue étrangère apprise dans des alliances françaises, des universités et des écoles ; il n’a pas de statut officiel.",
    vigilance: "Les apprenants de français langue étrangère sont souvent solides sur les exercices guidés, mais moins à l’aise en production libre, avec le genre des noms, les articles et le rythme de l’oral.",
    advice: "Multipliez les productions libres chronométrées et écoutez du français authentique chaque jour, car la compréhension orale à vitesse naturelle est souvent le point le plus exigeant.",
  },
];

/* ================= Pages de guide (SEO programmatique) ================= */

export interface GuideSection {
  h: string;
  p: string[];
  table?: { head: string[]; rows: string[][] };
}

export interface GuidePage {
  exam: Exam;
  slug: string;
  kind: "pays" | "nclc" | "format" | "theme";
  title: string;
  description: string;
  h1: string;
  intro: string;
  sections: GuideSection[];
  faq: Array<{ q: string; a: string }>;
  cta: { label: string; href: string };
}

const NCLC_DESC: Record<number, { cecr: string; can: string; next: string }> = {
  4: { cecr: "A2 haut", can: "Vous communiquez sur des sujets familiers avec des phrases simples. Les erreurs sont fréquentes mais le sens reste en général compréhensible.", next: "Apprenez à enchaîner vos phrases avec des connecteurs simples et à raconter au passé sans vous arrêter à chaque verbe." },
  5: { cecr: "B1 début", can: "Vous racontez des événements, décrivez vos projets et écrivez des messages courts. Les textes restent simples et les structures répétitives.", next: "Variez le vocabulaire, utilisez le passé composé et l’imparfait à bon escient et structurez vos textes en introduction, développement et conclusion." },
  6: { cecr: "B1", can: "Vous vous exprimez avec une certaine aisance sur des sujets courants et vous rédigez des textes organisés, malgré des erreurs qui peuvent gêner la lecture par moments.", next: "Réduisez les erreurs d’accord et de conjugaison, et travaillez l’argumentation : donner un avis, le justifier, nuancer." },
  7: { cecr: "B2 début", can: "Vous produisez des textes clairs et cohérents, vous défendez un point de vue et vous suivez des échanges au rythme normal. Les erreurs existent mais ne gênent pas la compréhension.", next: "Pour viser NCLC 8, soignez la précision lexicale, la variété des structures (subordonnées, pronoms relatifs) et la gestion de la nuance." },
  8: { cecr: "B2 confirmé", can: "Vous vous exprimez avec précision, vous nuancez vos arguments et vos erreurs sont rares et peu gênantes.", next: "Pour NCLC 9, travaillez le registre soutenu, les structures complexes et la concision." },
  9: { cecr: "C1 début", can: "Vous vous exprimez spontanément et avec fluidité, sur des sujets variés, avec un vocabulaire riche et une organisation maîtrisée.", next: "Pour NCLC 10, consolidez la maîtrise des nuances, des tournures idiomatiques et du style adapté à chaque destinataire." },
  10: { cecr: "C1 confirmé et plus", can: "Vous maîtrisez la langue dans des situations exigeantes, avec une grande précision, des nuances fines et très peu d’erreurs.", next: "À ce niveau, le gain de points CRS ne progresse plus : le maximum de points par compétence est atteint pour la première langue." },
};

const SKILL_ADVICE: Record<Skill, { what: string; pitfalls: string[]; method: string[] }> = {
  CE: {
    what: "La compréhension écrite mesure votre capacité à comprendre des textes de difficulté croissante, des messages simples jusqu’aux textes argumentatifs.",
    pitfalls: ["lire trop lentement les premières questions faciles et manquer de temps pour les dernières, plus difficiles", "choisir une réponse parce qu’un mot du texte y apparaît, sans vérifier le sens", "ne pas distinguer l’idée principale d’un détail"],
    method: ["Lisez la question avant le texte, puis cherchez dans le texte la phrase qui justifie la réponse.", "Éliminez d’abord les options qui contredisent le texte ; il reste en général une seule réponse défendable.", "Entraînez-vous avec des séries chronométrées de dix questions et notez, pour chaque erreur, la phrase du texte que vous avez mal comprise."],
  },
  CO: {
    what: "La compréhension orale mesure votre capacité à comprendre des enregistrements variés, d’un message simple à un échange rapide ou un exposé.",
    pitfalls: ["se bloquer sur un mot inconnu et perdre le fil de la suite", "ne pas anticiper la question pendant l’écoute", "sous-estimer la vitesse et les liaisons des locuteurs natifs"],
    method: ["Pendant l’écoute, notez des mots-clés, pas des phrases.", "Écoutez chaque jour du français authentique (radio, balados, journaux) à vitesse normale, quelques minutes plutôt qu’une longue séance.", "Réécoutez toujours un extrait raté en lisant la transcription, puis sans la transcription."],
  },
  EE: {
    what: "L’expression écrite mesure votre capacité à produire des textes adaptés à une consigne précise, dans un nombre de mots imposé, avec une langue correcte et variée.",
    pitfalls: ["ne pas atteindre le nombre de mots minimal, ce qui peut pénaliser lourdement l’évaluation", "réciter un gabarit appris par cœur qui ne répond pas à la consigne", "négliger la relecture finale des accords et des terminaisons verbales"],
    method: ["Planifiez en deux minutes : idées, ordre, formule d’ouverture et de clôture adaptées au destinataire.", "Comptez vos mots à chaque entraînement et visez le milieu de la fourchette demandée.", "Gardez cinq minutes pour la relecture, en suivant toujours le même ordre : verbes, accords, ponctuation, orthographe."],
  },
  EO: {
    what: "L’expression orale mesure votre capacité à vous présenter, à obtenir des informations et à défendre un point de vue, face à un examinateur.",
    pitfalls: ["parler trop vite pour masquer le stress et perdre la clarté", "s’arrêter longtemps pour chercher un mot précis au lieu de reformuler", "réciter un discours préparé qui ne répond pas à la question posée"],
    method: ["Structurez toujours votre réponse : position, deux arguments avec exemples, conclusion courte.", "Si un mot manque, décrivez-le (« une sorte de… », « ce qui permet de… ») sans vous arrêter.", "Enregistrez-vous trois minutes par jour sur un sujet imposé, puis réécoutez-vous une fois pour noter deux points à corriger."],
  },
};

function crsBridge(exam: Exam): GuideSection {
  const s = frenchSeedStats();
  return {
    h: "Pourquoi le français pèse lourd dans l’Entrée express",
    p: [
      `Dans l’Entrée express, les candidats sont classés selon le Système de classement global (CRS). Une bonne maîtrise du français rapporte des points de deux façons : par les points de langue (en première ou en deuxième langue officielle) et par un bonus lorsque vous atteignez au moins le NCLC 7 aux quatre compétences en français.`,
      `Il existe aussi des tirages réservés aux candidats francophones. Selon les données de départ de Cap7, ${s.count} tirages de ce type ont eu lieu entre février et octobre 2026, avec un CRS minimum compris entre ${s.min} et ${s.max}. Ces chiffres évoluent à chaque tirage : consultez la page des tirages pour les valeurs à jour, et ne considérez aucun d’eux comme une promesse pour la suite.`,
      `Pour estimer ce que le français vous rapporterait, utilisez le calculateur de Cap7 : il compare votre situation actuelle avec les derniers tirages et affiche clairement ce qu’il ne calcule pas (transférabilité des compétences, conjoint). Le ${EXAMS[exam].name} permet ensuite de prouver votre niveau avec un résultat reconnu par IRCC.`,
    ],
  };
}

function examScoreTable(exam: Exam): GuideSection {
  const rows = nclcTableRows(exam).map((r) => [`NCLC ${r.nclc}`, r.ranges.CO, r.ranges.CE, r.ranges.EE, r.ranges.EO]);
  return {
    h: `Table de conversion ${EXAMS[exam].name} vers NCLC`,
    p: [
      exam === "tef"
        ? "Pour l’Entrée express, IRCC utilise la colonne « équivalence ancien score » de votre attestation de résultats. Les scores indiqués ci-dessous sont ceux de cette colonne : compréhension orale sur 360, compréhension écrite sur 300, expression écrite et orale sur 450."
        : "Le TCF Canada exprime la compréhension orale et écrite en scores sur 699, et l’expression écrite et orale en notes sur 20. Chaque compétence est convertie séparément en niveau NCLC.",
      "Table indicative établie à partir des tableaux d’équivalence d’IRCC ; vérifiez toujours la version en vigueur sur le site officiel avant de décider de votre date d’examen.",
    ],
    table: { head: ["Niveau", "CO", "CE", "EE", "EO"], rows },
  };
}

function genericFaq(exam: Exam): Array<{ q: string; a: string }> {
  return [FAQ[0], { q: `Mes résultats de ${EXAMS[exam].name} sont-ils valables longtemps ?`, a: FAQ[2].a }, FAQ[3]];
}

/** « le Maroc » -> « du Maroc », « la France » -> « de la France », « l’Inde » -> « de l’Inde », « Haïti » -> « d’Haïti ». */
function de(name: string): string {
  if (name.startsWith("le ")) return "du " + name.slice(3);
  if (name.startsWith("la ")) return "de la " + name.slice(3);
  if (name.startsWith("l’")) return "de l’" + name.slice(2);
  return "d’" + name;
}

function paysPage(exam: Exam, c: Country): GuidePage {
  const ex = EXAMS[exam];
  const tasks = ex.writing.map((t) => `${t.label} (${t.minWords}${t.maxWords ? "–" + t.maxWords : "+"} mots)`).join(", ");
  return {
    exam,
    slug: `depuis-${c.slug}`,
    kind: "pays",
    title: `${ex.name} depuis ${c.name} : préparer NCLC 7`,
    description: `Candidats depuis ${c.name} : comment préparer le ${ex.name}, atteindre NCLC 7 et comprendre ce que le français rapporte en points CRS.`,
    h1: `Préparer le ${ex.name} depuis ${c.name}`,
    intro: `${c.status} Cette page s’adresse aux candidats ${de(c.name)} qui visent le niveau NCLC 7 aux quatre compétences pour l’Entrée express, avec le ${ex.name}.`,
    sections: [
      { h: `Votre point de départ`, p: [c.status, c.vigilance, c.advice] },
      {
        h: `Ce que demande le ${ex.name}`,
        p: [
          `Le ${ex.name} est organisé par ${ex.owner} et ses résultats sont valables ${ex.validityYears} ans. Les quatre épreuves sont : compréhension orale (${ex.durations.CO}), compréhension écrite (${ex.durations.CE}), expression écrite (${ex.durations.EE}) et expression orale (${ex.durations.EO}).`,
          `Pour l’expression écrite, les consignes de longueur sont : ${tasks}. Un texte trop court peut être sanctionné ; comptez vos mots à chaque entraînement.`,
          ex.formatNote,
        ],
      },
      examScoreTable(exam),
      crsBridge(exam),
      {
        h: "Un plan réaliste pour atteindre NCLC 7",
        p: [
          "Commencez par mesurer votre niveau réel dans chaque compétence, car NCLC 7 est exigé partout : un seul niveau 6 vous bloque. Une correction écrite, une correction orale et une série de compréhension de chaque type suffisent pour savoir où vous en êtes.",
          "Ensuite, travaillez la compétence la plus faible en priorité, avec des séances courtes et régulières. Trois à quatre séances par semaine, de trente à quarante-cinq minutes, valent mieux qu’un long week-end intensif.",
          "Passez l’examen quand vos résultats d’entraînement sont stables au niveau visé pendant au moins deux semaines. Un résultat estimé ne garantit pas le score réel : gardez une marge.",
        ],
      },
    ],
    faq: genericFaq(exam),
    cta: { label: "Estimer mes points CRS", href: "/calculateur" },
  };
}

function nclcPage(exam: Exam, n: number): GuidePage {
  const ex = EXAMS[exam];
  const d = NCLC_DESC[n];
  const rows = SKILLS.map((k) => {
    const r = nclcTableRows(exam).find((x) => x.nclc === n)!.ranges[k];
    return [SKILL_LABEL[k], r, String(firstLangPoints(n)), String(secondLangPoints(n))];
  });
  return {
    exam,
    slug: `nclc-${n}`,
    kind: "nclc",
    title: `NCLC ${n} au ${ex.name} : scores, points CRS et préparation`,
    description: `Quels scores au ${ex.name} pour atteindre NCLC ${n} ? Table de conversion, points CRS associés et conseils pour y arriver.`,
    h1: `NCLC ${n} au ${ex.name}`,
    intro: `Le niveau NCLC ${n} correspond approximativement au niveau ${d.cecr} du CECR (correspondance indicative). ${d.can}`,
    sections: [
      {
        h: `Scores nécessaires pour NCLC ${n}`,
        p: [
          `Voici les scores du ${ex.name} qui correspondent au NCLC ${n}, compétence par compétence, ainsi que les points CRS correspondants pour un candidat seul. Chaque compétence est convertie séparément : un niveau inférieur dans une seule compétence ne peut pas être compensé par une autre.`,
        ],
        table: { head: ["Compétence", "Score", "Points CRS (1re langue)", "Points CRS (2e langue)"], rows },
      },
      { h: "Ce que ce niveau signifie concrètement", p: [d.can, `Pour la suite : ${d.next}`] },
      examScoreTable(exam),
      crsBridge(exam),
      {
        h: `S’entraîner pour atteindre NCLC ${n}`,
        p: [
          SKILL_ADVICE.EE.method[0] + " " + SKILL_ADVICE.EO.method[0],
          "Faites-vous corriger régulièrement : une correction qui nomme vos erreurs les plus coûteuses d’abord vous fait gagner plus de temps que dix textes non relus.",
        ],
      },
    ],
    faq: genericFaq(exam),
    cta: { label: "Essayer une correction gratuite", href: "/connexion" },
  };
}

function formatPage(exam: Exam, k: Skill): GuidePage {
  const ex = EXAMS[exam];
  const a = SKILL_ADVICE[k];
  const slug = { CE: "comprehension-ecrite", CO: "comprehension-orale", EE: "expression-ecrite", EO: "expression-orale" }[k];
  const tasks = k === "EE" ? ex.writing : k === "EO" ? ex.speaking : [];
  return {
    exam,
    slug,
    kind: "format",
    title: `${SKILL_LABEL[k]} au ${ex.name} : format, pièges et méthode`,
    description: `Format de l’épreuve de ${SKILL_LABEL[k].toLowerCase()} du ${ex.name}, erreurs fréquentes et méthode d’entraînement pour viser NCLC 7.`,
    h1: `${SKILL_LABEL[k]} au ${ex.name}`,
    intro: `${a.what} Durée de l’épreuve : ${ex.durations[k]}.`,
    sections: [
      {
        h: "Ce que contient l’épreuve",
        p: tasks.length
          ? [`Les tâches de ${ex.name} sont les suivantes.`, ...tasks.map((t) => `${t.label} : ${t.brief}${t.minWords ? ` (${t.minWords}${t.maxWords ? " à " + t.maxWords : " au minimum"} mots)` : ""}`)]
          : [`L’épreuve est composée de questions à choix multiple de difficulté croissante. ${ex.formatNote}`],
      },
      { h: "Les pièges les plus courants", p: a.pitfalls.map((x) => `Piège fréquent : ${x}.`) },
      { h: "Une méthode d’entraînement", p: a.method },
      examScoreTable(exam),
      crsBridge(exam),
    ],
    faq: genericFaq(exam),
    cta: { label: "S’entraîner gratuitement", href: "/connexion" },
  };
}

const THEMES: Array<{ slug: string; build: (exam: Exam) => Omit<GuidePage, "exam" | "slug" | "kind"> }> = [
  {
    slug: "points-crs-francais",
    build: (exam) => ({
      title: `Combien de points CRS rapporte le français avec le ${EXAMS[exam].name} ?`,
      description: "Points de langue en première ou deuxième langue, bonus français et différence avec la situation actuelle : le calcul expliqué pour un candidat seul.",
      h1: "Combien de points CRS rapporte le français ?",
      intro: "Le français rapporte des points CRS de trois façons : comme première langue, comme deuxième langue et par un bonus qui récompense le bilinguisme. Voici le principe, pour un candidat seul.",
      sections: [
        {
          h: "Points par compétence",
          p: ["Chaque compétence (compréhension orale, compréhension écrite, expression écrite, expression orale) est notée séparément. Le total des quatre compétences donne les points de langue."],
          table: {
            head: ["Niveau NCLC/CLB", "1re langue (par compétence)", "2e langue (par compétence)"],
            rows: [4, 5, 6, 7, 8, 9, 10].map((n) => [`${n}${n === 10 ? " ou plus" : ""}`, String(firstLangPoints(n)), String(secondLangPoints(n))]),
          },
        },
        {
          h: "Le bonus français",
          p: [
            "Si vous atteignez NCLC 7 ou plus aux quatre compétences en français, vous recevez 25 points supplémentaires lorsque votre anglais est au niveau CLB 4 ou moins (ou absent), et 50 points lorsque votre anglais est au niveau CLB 5 ou plus aux quatre compétences.",
            "Le calcul de Cap7 compare deux options (français en deuxième langue, ou français en première langue avec l’anglais en deuxième) et retient la plus avantageuse, puis ajoute le bonus.",
          ],
        },
        { h: "Ce que le calcul n’inclut pas", p: ["Le calculateur ne tient pas compte de la transférabilité des compétences, qui peut aussi changer avec votre niveau de langue, ni du conjoint. Il s’agit d’une estimation, pas du résultat officiel du système d’IRCC."] },
        examScoreTable(exam),
        crsBridge(exam),
      ],
      faq: genericFaq(exam),
      cta: { label: "Calculer mon gain", href: "/calculateur" },
    }),
  },
  {
    slug: "plan-de-preparation",
    build: (exam) => ({
      title: `Plan de préparation au ${EXAMS[exam].name} jusqu’à votre date d’examen`,
      description: "Comment répartir vos séances de préparation selon vos faiblesses mesurées, de la première correction à la veille de l’examen.",
      h1: "Un plan de préparation qui part de vos faiblesses",
      intro: "Un bon plan se construit à l’envers : on part de la date d’examen, on mesure le niveau actuel et on répartit le travail sur les points les plus coûteux.",
      sections: [
        {
          h: "Première semaine : mesurer",
          p: ["Faites une expression écrite, une expression orale et une série de compréhension de chaque type. Notez la fourchette NCLC obtenue et les trois erreurs les plus répétées.", "Ne cherchez pas encore à progresser : cherchez à savoir précisément où vous perdez des points."],
        },
        {
          h: "Semaines suivantes : cibler",
          p: ["Attribuez la majorité du temps à la compétence la plus faible, et réservez une séance par semaine aux autres pour ne pas les laisser baisser. Chaque séance doit se terminer par une production évaluée, pas seulement une lecture de règles.", "Si votre point faible est la grammaire, travaillez deux règles par semaine, pas dix. Si c’est la fluidité, enregistrez-vous régulièrement et réécoutez-vous."],
        },
        {
          h: "Dernières semaines : simuler",
          p: ["Faites des épreuves complètes dans les conditions réelles : chronomètre, nombre de mots, sans dictionnaire. Les deux dernières semaines, réduisez les nouveautés et consolidez ce qui fonctionne.", "Gardez toujours une marge : ne prenez date d’examen que lorsque vos résultats d’entraînement sont stables au niveau visé."],
        },
        examScoreTable(exam),
        crsBridge(exam),
      ],
      faq: genericFaq(exam),
      cta: { label: "Créer mon plan", href: "/connexion" },
    }),
  },
  {
    slug: "resultats-et-validite",
    build: (exam) => ({
      title: `Résultats du ${EXAMS[exam].name} : validité, conversion et attestation`,
      description: `Combien de temps vos résultats du ${EXAMS[exam].name} sont-ils valables, comment lire l’attestation et comment IRCC convertit les scores.`,
      h1: `Résultats du ${EXAMS[exam].name} : ce qu’il faut savoir`,
      intro: `Les résultats du ${EXAMS[exam].name} sont valables ${EXAMS[exam].validityYears} ans pour l’Entrée express. Voici comment les lire, et quoi vérifier avant de créer votre profil.`,
      sections: [
        {
          h: "Lire son attestation",
          p: ["Votre attestation indique un score par compétence. IRCC convertit chaque score en niveau NCLC séparément ; c’est ce niveau, pas la moyenne, qui compte pour l’admissibilité et pour les points.", exam === "tef" ? "Pour le TEF Canada, IRCC retient la colonne « équivalence ancien score » ; saisissez les valeurs de cette colonne et non le score sur 699." : "Pour le TCF Canada, saisissez les scores de compréhension (sur 699) et les notes d’expression (sur 20) tels qu’ils figurent sur l’attestation."],
        },
        { h: "Avant de créer ou de mettre à jour son profil", p: ["Vérifiez que vos résultats ont moins de deux ans à la date où vous créez le profil et à la date de l’invitation. Un résultat expiré n’est plus accepté.", "Si l’un de vos niveaux est inférieur à NCLC 7, vous n’êtes pas éligible aux tirages réservés aux candidats francophones, même si vos trois autres compétences sont excellentes."] },
        examScoreTable(exam),
        crsBridge(exam),
      ],
      faq: genericFaq(exam),
      cta: { label: "Estimer mon niveau", href: "/connexion" },
    }),
  },
  {
    slug: "erreurs-frequentes",
    build: (exam) => ({
      title: `Les erreurs qui font perdre un niveau au ${EXAMS[exam].name}`,
      description: "Accords, temps, connecteurs, registre, gabarits récités : les erreurs qui coûtent le plus cher en expression écrite et orale.",
      h1: "Les erreurs qui coûtent un niveau",
      intro: "Toutes les erreurs ne se valent pas : certaines gênent la compréhension et pèsent lourd, d’autres sont peu pénalisantes. Voici celles à traiter d’abord.",
      sections: [
        { h: "Erreurs de structure et de consigne", p: ["Ne pas répondre à la consigne, ne pas respecter le nombre de mots, ou réciter un modèle appris par cœur : ces fautes coûtent plus que dix fautes d’accord. Le correcteur de Cap7 signale les gabarits appris par cœur parce qu’ils ne montrent pas votre vrai niveau.", "Lisez la consigne deux fois et soulignez le destinataire, le but et la longueur avant d’écrire."] },
        { h: "Erreurs de langue à traiter en priorité", p: ["Les accords (sujet-verbe, nom-adjectif, participe passé), les temps du passé et les prépositions reviennent dans la plupart des copies de niveau B1. Les connecteurs trop répétitifs et le registre inadapté sont les freins habituels pour passer de NCLC 6 à NCLC 7.", "Tenez une liste de vos trois erreurs les plus fréquentes et relisez-la avant chaque production ; la répétition ciblée est plus efficace qu’un manuel de grammaire entier."] },
        { h: "Erreurs à l’oral", p: ["Parler très vite pour cacher son stress, se taire pendant plusieurs secondes pour chercher un mot, ou répondre à côté de la question font perdre des points de fluidité et d’adéquation. Mieux vaut reformuler que s’arrêter.", "Cap7 ne mesure pas votre prononciation : faites-vous aussi écouter par une personne francophone avant l’examen."] },
        examScoreTable(exam),
        crsBridge(exam),
      ],
      faq: genericFaq(exam),
      cta: { label: "Me faire corriger gratuitement", href: "/connexion" },
    }),
  },
];

export function allGuideParams(): Array<{ exam: Exam; slug: string }> {
  const out: Array<{ exam: Exam; slug: string }> = [];
  for (const exam of EXAM_LIST) {
    for (const c of COUNTRIES) out.push({ exam, slug: `depuis-${c.slug}` });
    for (let n = 4; n <= 10; n++) out.push({ exam, slug: `nclc-${n}` });
    for (const k of SKILLS) out.push({ exam, slug: { CE: "comprehension-ecrite", CO: "comprehension-orale", EE: "expression-ecrite", EO: "expression-orale" }[k] });
    for (const t of THEMES) out.push({ exam, slug: t.slug });
  }
  return out;
}

export function buildGuide(exam: Exam, slug: string): GuidePage | null {
  if (slug.startsWith("depuis-")) {
    const c = COUNTRIES.find((x) => `depuis-${x.slug}` === slug);
    return c ? paysPage(exam, c) : null;
  }
  const nm = slug.match(/^nclc-(\d+)$/);
  if (nm) {
    const n = Number(nm[1]);
    return n >= 4 && n <= 10 ? nclcPage(exam, n) : null;
  }
  const skill = (Object.entries({ CE: "comprehension-ecrite", CO: "comprehension-orale", EE: "expression-ecrite", EO: "expression-orale" }) as Array<[Skill, string]>).find(([, s]) => s === slug);
  if (skill) return formatPage(exam, skill[0]);
  const th = THEMES.find((t) => t.slug === slug);
  return th ? { exam, slug, kind: "theme", ...th.build(exam) } : null;
}

/** Nombre de mots d’une page de guide (test de qualité : >= 300). */
export function guideWordCount(g: GuidePage): number {
  const parts: string[] = [g.intro];
  for (const s of g.sections) {
    parts.push(s.h, ...s.p);
    if (s.table) for (const r of s.table.rows) parts.push(r.join(" "));
  }
  for (const f of g.faq) parts.push(f.q, f.a);
  return parts.join(" ").split(/\s+/).filter(Boolean).length;
}

/* ================= Pages légales ================= */

export interface LegalPage {
  slug: string;
  title: string;
  sections: Array<{ h: string; p: string[] }>;
}

export const NON_AFFILIATION =
  "Cap7 n’est affilié ni à France Éducation international, ni à la CCI Paris Île-de-France, ni à IRCC. TCF Canada et TEF Canada sont des marques de leurs propriétaires. Estimations indicatives non officielles.";

export const LEGAL: LegalPage[] = [
  {
    slug: "non-affiliation",
    title: "Non-affiliation et avertissement",
    sections: [
      { h: "Non-affiliation", p: [NON_AFFILIATION] },
      {
        h: "Nature des estimations",
        p: [
          "Les niveaux NCLC affichés par Cap7 sont des fourchettes estimées par un correcteur automatique appliquant un barème approximatif, non officiel. Ils ne constituent ni un résultat d’examen, ni une prédiction de votre score, ni une garantie d’invitation à présenter une demande de résidence permanente.",
          "Les points CRS calculés par le calculateur sont des estimations pour un candidat seul. Seul le système officiel d’IRCC fait foi. Consultez toujours les pages officielles d’IRCC avant de prendre une décision de candidature.",
        ],
      },
      { h: "Marques", p: ["Les marques citées sont utilisées à titre descriptif uniquement, pour indiquer les examens auxquels Cap7 prépare."] },
    ],
  },
  {
    slug: "cgu",
    title: "Conditions générales d’utilisation et de vente",
    sections: [
      { h: "Objet", p: ["Cap7 propose des outils d’entraînement au TCF Canada et au TEF Canada : calculateur de points, corrections automatisées de productions écrites et orales, séries de compréhension, plan de travail. Le service est fourni « en l’état », sans garantie de résultat à l’examen."] },
      { h: "Compte", p: ["Vous devez fournir une adresse e-mail valide et choisir un mot de passe d’au moins dix caractères. Vous êtes responsable de la confidentialité de vos identifiants. Un seul compte gratuit par personne ; les abus (comptes multiples, contournement des limites) peuvent entraîner la suspension du compte."] },
      { h: "Offres et paiement", p: ["Le niveau gratuit comprend une correction écrite, une correction orale, une série de compréhension écrite et une série de compréhension orale. Les pass de 30 et de 90 jours sont vendus en paiement unique, sans abonnement ni renouvellement automatique. Le prix et le nombre de corrections de chaque pass sont indiqués sur la page des tarifs. Le paiement est traité par un prestataire tiers qui agit comme vendeur de référence.", "Un plafond de huit corrections par jour s’applique à chaque utilisateur, ainsi qu’un usage raisonnable pour les séries de compréhension."] },
      { h: "Remboursement", p: [REFUND_POLICY] },
      { h: "Contenus et propriété", p: ["Vos textes et enregistrements vous appartiennent. Vous nous autorisez uniquement à les traiter pour produire votre correction. Les contenus de Cap7 (sujets, séries, interface) ne peuvent pas être reproduits ou revendus. Les sujets et séries sont originaux et ne sont pas des sujets réels d’examen."] },
      { h: "Limitation de responsabilité", p: ["Les estimations sont indicatives. Cap7 ne peut être tenu responsable d’un écart entre une estimation et votre résultat officiel, ni d’une décision prise à partir de ces estimations."] },
      { h: "Disponibilité", p: ["Cap7 peut suspendre temporairement certaines fonctions, notamment les corrections, en cas de forte charge ou de limite de coût atteinte, avec un message clair. Aucune perte de crédit n’est imputée à l’utilisateur dans ce cas."] },
    ],
  },
  {
    slug: "confidentialite",
    title: "Politique de confidentialité",
    sections: [
      { h: "Données collectées", p: ["Nous collectons votre adresse e-mail, un mot de passe (stocké sous forme de hachage, jamais en clair), votre pays, votre examen cible, votre date d’examen, vos textes et transcriptions, vos résultats d’entraînement et un identifiant technique dérivé de votre adresse IP (haché avec un sel secret ; nous ne stockons jamais l’adresse IP brute)."] },
      { h: "Enregistrements vocaux", p: ["Vos enregistrements vocaux ne sont jamais conservés. L’audio est transcrit en mémoire puis supprimé ; seule la transcription est stockée avec votre tentative."] },
      { h: "Utilisation", p: ["Vos textes et transcriptions sont envoyés à un fournisseur de modèle de langage et, pour la transcription, à un fournisseur de reconnaissance vocale, uniquement pour produire votre correction. Ils ne sont pas utilisés pour de la publicité."] },
      { h: "Résultat officiel et partage", p: ["Si vous déclarez votre résultat officiel, vous choisissez explicitement si Cap7 peut l’utiliser sous forme anonymisée ou comme témoignage. Une carte de résultat n’est publique que si vous activez le partage, et elle ne contient jamais le texte de votre essai."] },
      { h: "Conservation et suppression", p: ["Vos tentatives sont conservées tant que votre compte existe. Vous pouvez supprimer votre compte à tout moment depuis votre espace : toutes vos données sont alors effacées."] },
      { h: "Sous-traitants", p: [`Hébergement : ${PUBLISHER.hosting}. Paiement : prestataire de paiement tiers, qui traite vos données de facturation. Fournisseurs d’intelligence artificielle : voir la section dédiée ci-dessous.`] },
      { h: "Vos droits", p: ["Vous pouvez demander l’accès, la rectification ou l’effacement de vos données en nous écrivant à l’adresse de contact indiquée dans les mentions légales."] },
    ],
  },
  {
    slug: "mentions",
    title: "Mentions légales",
    sections: [
      { h: "Éditeur", p: [`${PUBLISHER.legalName}. ${PUBLISHER.address}. Pays : ${PUBLISHER.country}.`] },
      { h: "Hébergement", p: [PUBLISHER.hosting + "."] },
      { h: "Contact", p: ["Pour toute question, écrivez à l’adresse de contact affichée en pied de page."] },
      { h: "Non-affiliation", p: [NON_AFFILIATION] },
    ],
  },
];

export function legalPage(slug: string): LegalPage | null {
  return LEGAL.find((l) => l.slug === slug) ?? null;
}

/* ================= Divers ================= */

export const IRCC_CRS_TOOL_URL = "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score.html";
export const IRCC_ROUNDS_URL = "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations.html";

export const COUNTRY_CODES = COUNTRIES.map((c) => c.slug);
export const COUNTRY_CHOICES: Array<{ value: string; label: string }> = [
  ...COUNTRIES.map((c) => ({ value: c.slug, label: c.name.replace(/^(le |la |l’)/, "").replace(/^./, (x) => x.toUpperCase()) })),
  { value: "autre", label: "Autre pays" },
];

/** Section « Fournisseurs d'IA » de la page de confidentialité, construite d'après les fournisseurs réellement actifs (voir core.activeProviders). */
export function providersSection(
  active: Array<{ provider: "anthropic" | "openai" | "gemini"; roles: string[] }>,
  geminiTier: "free" | "paid",
): { h: string; p: string[] } {
  const NAME = { anthropic: "Anthropic (modèles Claude)", openai: "OpenAI", gemini: "Google (API Gemini)" };
  const p: string[] = [];
  if (active.length === 0) {
    p.push("Aucun fournisseur d’intelligence artificielle n’est actif pour le moment.");
  } else {
    p.push("Pour produire le service, vos textes, transcriptions et, selon la fonction, vos enregistrements sont envoyés aux fournisseurs d’intelligence artificielle suivants :");
    for (const a of active) p.push(`${NAME[a.provider]} : ${a.roles.join(", ")}.`);
  }
  if (active.some((a) => a.provider === "gemini")) {
    p.push(
      geminiTier === "free"
        ? "Ce site utilise le palier gratuit de l’API Gemini : Google peut réutiliser les contenus envoyés pour améliorer ses produits. N’y saisissez rien que vous ne souhaitez pas partager."
        : "Sur le palier gratuit de l’API Gemini, Google peut réutiliser les contenus envoyés pour améliorer ses produits ; ce site utilise le palier payant, soumis aux conditions de Google correspondantes.",
    );
  }
  p.push("Cap7 ne conserve jamais vos enregistrements vocaux : ils sont traités en mémoire puis supprimés ; seule la transcription est stockée. Pendant la transcription, le fournisseur concerné reçoit l’enregistrement le temps du traitement.");
  return { h: "Fournisseurs d’intelligence artificielle", p };
}

/** Section « Connexion et e-mails » de la page de confidentialité, construite d'après les services réellement activés. */
export function accountServicesSection(a: { google: boolean; mail: "smtp" | "resend" | null }): { h: string; p: string[] } {
  const p: string[] = [];
  if (a.google) {
    p.push("Connexion avec Google : si vous choisissez cette option, Google nous transmet votre adresse e-mail vérifiée et votre nom, jamais votre mot de passe Google. Nous conservons l’identifiant Google associé à votre compte pour vous reconnaître, et nous ne stockons pas votre photo. Les informations que Google ne fournit pas (pays de résidence, examen visé) vous sont demandées ensuite.");
  }
  if (a.mail === "smtp") p.push("E-mails de service (confirmation d’adresse, réinitialisation du mot de passe) : ils sont envoyés par le serveur SMTP de Google (Gmail), qui reçoit votre adresse e-mail et le contenu du message.");
  if (a.mail === "resend") p.push("E-mails de service (confirmation d’adresse, réinitialisation du mot de passe) : ils sont envoyés par le prestataire Resend, qui reçoit votre adresse e-mail et le contenu du message.");
  if (!a.mail) p.push("Aucun e-mail de service n’est envoyé : la confirmation d’adresse et la réinitialisation du mot de passe par e-mail ne sont pas activées.");
  p.push("Vous pouvez changer votre mot de passe et supprimer votre compte à tout moment depuis votre espace.");
  return { h: "Connexion et e-mails", p };
}
