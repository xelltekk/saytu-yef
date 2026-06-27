import { LegalPage, type LegalSection } from '@/components/legal/LegalPage'

export const dynamic = 'force-dynamic'

const sections: LegalSection[] = [
  {
    title: '1. Objet du service',
    paragraphs: [
      'Saytu Yëf est une application de gestion destinée aux commerçants : stock, ventes, reçus, clients, dettes, fournisseurs, rapports et suivi d’activité.',
      'Le service est fourni en version pilote commerciale. Certaines fonctionnalités peuvent encore évoluer selon les retours des boutiques test.',
    ],
  },
  {
    title: '2. Création du compte',
    items: [
      'L’utilisateur doit fournir des informations exactes lors de l’inscription.',
      'Le compte administrateur est responsable de la boutique et des employés ajoutés.',
      'L’utilisateur doit protéger ses identifiants et signaler toute utilisation suspecte.',
    ],
  },
  {
    title: '3. Utilisation autorisée',
    paragraphs: [
      'L’utilisateur s’engage à utiliser Saytu Yëf pour une activité commerciale légale et à ne pas détourner le service pour nuire à l’application, aux autres utilisateurs ou aux infrastructures techniques.',
    ],
    items: [
      'Ne pas tenter d’accéder aux données d’une autre boutique.',
      'Ne pas contourner les contrôles d’accès, les rôles ou la sécurité.',
      'Ne pas envoyer de données illégales, frauduleuses ou manifestement abusives.',
      'Ne pas utiliser le service pour spammer des clients ou contacts.',
    ],
  },
  {
    title: '4. Responsabilités du commerçant',
    items: [
      'Vérifier les prix, quantités, reçus et rapports avant toute décision commerciale.',
      'Effectuer les remboursements financiers par le moyen convenu avec le client.',
      'Informer ses clients lorsque leurs informations sont enregistrées pour le suivi des dettes ou des reçus.',
      'Respecter les obligations fiscales, comptables et réglementaires liées à son activité.',
    ],
  },
  {
    title: '5. Disponibilité et maintenance',
    paragraphs: [
      'L’équipe fait ses meilleurs efforts pour maintenir le service disponible, sauvegardé et surveillé. Des interruptions peuvent toutefois survenir pour maintenance, incident technique, hébergeur, réseau ou force majeure.',
      'En version pilote, certains ajustements peuvent être livrés rapidement afin de corriger des bugs ou améliorer l’expérience.',
    ],
  },
  {
    title: '6. Abonnements et paiement',
    paragraphs: [
      'Les prix affichés sont des tarifs de lancement et peuvent évoluer. Les changements importants seront communiqués avant application aux clients concernés.',
      'Tant que la facturation en ligne n’est pas activée dans l’application, aucun prélèvement automatique ne peut être déclenché depuis Saytu Yëf.',
    ],
  },
  {
    title: '7. Données et sauvegardes',
    paragraphs: [
      'Le commerçant conserve la responsabilité des données qu’il saisit dans sa boutique. Saytu Yëf met en place des mesures techniques raisonnables pour protéger, sauvegarder et restaurer les données en cas d’incident.',
      'Les sauvegardes sont destinées à la continuité du service, pas à remplacer une obligation comptable ou fiscale propre au commerçant.',
    ],
  },
  {
    title: '8. Suspension ou résiliation',
    paragraphs: [
      'Un compte peut être suspendu en cas d’usage abusif, fraude, risque de sécurité, non-paiement d’un abonnement applicable ou violation grave des présentes conditions.',
      'L’utilisateur peut demander l’arrêt de son compte auprès du support. Les modalités d’export ou de suppression seront traitées selon les contraintes techniques et légales applicables.',
    ],
  },
  {
    title: '9. Contact',
    paragraphs: [
      'Pour toute question sur ces conditions ou sur l’utilisation de Saytu Yëf : contact@xelltekk.com.',
    ],
  },
]

export default function TermsPage() {
  return (
    <LegalPage
      badge="Conditions d’utilisation"
      title="Conditions générales d’utilisation"
      description="Ces conditions définissent les règles d’usage de Saytu Yëf pendant la phase pilote commerciale et les premières offres payantes."
      updatedAt="27 juin 2026"
      sections={sections}
      disclaimer="Document de travail : ce modèle n’est pas une consultation juridique. Il doit être validé avant signature avec des clients payants."
    />
  )
}
