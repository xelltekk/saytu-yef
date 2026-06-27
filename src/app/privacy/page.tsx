import { LegalPage, type LegalSection } from '@/components/legal/LegalPage'

export const dynamic = 'force-dynamic'

const sections: LegalSection[] = [
  {
    title: '1. Qui est concerné ?',
    paragraphs: [
      'Cette politique s’adresse aux commerçants qui utilisent Saytu Yëf, à leurs employés et aux clients dont les informations peuvent être enregistrées dans l’application.',
      'Saytu Yëf est l’outil de gestion. Le commerçant reste responsable des informations qu’il choisit d’enregistrer sur ses clients, ses produits et ses ventes.',
    ],
  },
  {
    title: '2. Données que nous pouvons traiter',
    items: [
      'Informations du compte : nom, email, téléphone, rôle et informations de boutique.',
      'Données de gestion : produits, fournisseurs, ventes, reçus, paiements, dettes clients et mouvements de stock.',
      'Données techniques : adresse IP, journaux serveur, état de santé de l’application, erreurs et informations nécessaires à la sécurité.',
      'Données de support : messages envoyés par email, WhatsApp ou tout autre canal de contact utilisé pour l’assistance.',
    ],
  },
  {
    title: '3. Pourquoi ces données sont utilisées',
    items: [
      'Créer et sécuriser le compte utilisateur.',
      'Permettre la gestion du stock, des ventes, des dettes clients, des reçus et des rapports.',
      'Sauvegarder les données, surveiller le service et corriger les incidents.',
      'Répondre aux demandes de support et accompagner les boutiques pilotes.',
      'Améliorer le produit à partir de retours terrain et d’indicateurs techniques.',
    ],
  },
  {
    title: '4. Conservation et sauvegardes',
    paragraphs: [
      'Les données sont conservées tant que le compte reste actif ou aussi longtemps que nécessaire pour fournir le service, respecter les obligations légales applicables et gérer les incidents.',
      'Des sauvegardes automatiques peuvent être conservées pendant une durée limitée afin de restaurer le service en cas de problème technique.',
    ],
  },
  {
    title: '5. Partage des données',
    paragraphs: [
      'Les données ne sont pas revendues. Elles peuvent être traitées par des prestataires techniques nécessaires au fonctionnement du service, par exemple l’hébergement, la base de données, la surveillance et l’email.',
      'Un accès peut aussi être réalisé si la loi l’exige ou pour protéger le service contre la fraude, les abus ou les incidents de sécurité.',
    ],
  },
  {
    title: '6. Sécurité',
    items: [
      'Accès protégé par authentification.',
      'Rôles administrateur et employé dans l’application.',
      'Sauvegardes serveur et surveillance de disponibilité.',
      'Accès technique limité aux besoins de maintenance et de support.',
    ],
  },
  {
    title: '7. Droits des utilisateurs',
    paragraphs: [
      'Selon la réglementation applicable, une personne peut demander l’accès, la correction ou la suppression de ses données. Certaines informations peuvent devoir être conservées pour des raisons légales, comptables ou de sécurité.',
      'Pour exercer une demande, contactez l’équipe support avec l’adresse du compte concerné et une description claire de la demande.',
    ],
  },
  {
    title: '8. Contact confidentialité',
    paragraphs: [
      'Pour toute question relative aux données personnelles, contactez : contact@xelltekk.com.',
      'Référence utile : la Commission de Protection des Données Personnelles du Sénégal publie des informations sur la protection des données personnelles.',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      badge="Confidentialité"
      title="Politique de confidentialité"
      description="Ce modèle explique comment Saytu Yëf collecte, utilise, protège et conserve les données nécessaires au fonctionnement du service."
      updatedAt="27 juin 2026"
      sections={sections}
      disclaimer="Document de travail : ce texte doit être relu et adapté par un conseil juridique avant une commercialisation large."
    />
  )
}
