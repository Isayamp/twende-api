import type { ZodType } from 'zod';
import {
  schemaConnexion,
  schemaInscription,
  schemaJetonRafraichissement,
} from '../modules/auth/auth.schemas.js';
import {
  schemaArrets,
  schemaCreationLigne,
  schemaModificationLigne,
  schemaRechercheLignes,
  schemaTarifs,
} from '../modules/lignes/lignes.schemas.js';
import {
  schemaCreationPassager,
  schemaModificationPassager,
  schemaRecherchePassagers,
} from '../modules/passagers/passagers.schemas.js';
import {
  schemaCreationReservation,
  schemaListeReservations,
} from '../modules/reservations/reservations.schemas.js';
import { schemaRemplissage } from '../modules/statistiques/statistiques.schemas.js';
import {
  schemaCreationStation,
  schemaModificationStation,
  schemaRechercheStations,
} from '../modules/stations/stations.schemas.js';
import {
  schemaCreationTrajet,
  schemaListeTrajets,
  schemaModificationTrajet,
  schemaRechercheTrajets,
} from '../modules/trajets/trajets.schemas.js';
import {
  schemaCreationVehicule,
  schemaModificationVehicule,
  schemaRechercheVehicules,
} from '../modules/vehicules/vehicules.schemas.js';

/** Qui peut appeler la route. */
export type Acces = 'public' | 'connecte' | 'personnel' | 'admin';

/**
 * Description d'une route de l'API. Une seule liste sert à générer la spécification OpenAPI
 * (page /api-docs) ET la collection Postman : les deux restent identiques.
 * Les schémas Zod sont ceux que l'API utilise vraiment pour valider : pas de copie à tenir à jour.
 */
export interface Operation {
  methode: 'get' | 'post' | 'put' | 'patch' | 'delete';
  /** Chemin au format OpenAPI, ex. /stations/{id} (sans /api/v1). */
  chemin: string;
  tag: string;
  resume: string;
  acces: Acces;
  corps?: ZodType;
  exempleCorps?: unknown;
  requete?: ZodType;
  /** Paramètres de requête obligatoires (les autres sont facultatifs). */
  obligatoires?: string[];
  exempleRequete?: Record<string, string>;
  /** Succès : 200 par défaut. */
  statut?: 200 | 201 | 204;
  /** La réponse est une liste paginée (avec `meta`). */
  liste?: boolean;
  /** Codes d'erreur propres à la route (409, 429...). Les codes 401/403/404/422 sont déduits. */
  erreurs?: number[];
}

const STATION = { nom: 'Gare routière de Rohero', ville: 'Bujumbura', pays: 'Burundi' };
const PASSAGER = { nom_complet: 'Aimé Niyonkuru', telephone: '+25779000000' };

export const operations: Operation[] = [
  // ---------- Authentification ----------
  {
    methode: 'post',
    chemin: '/auth/register',
    tag: 'Authentification',
    resume: 'Inscription (rôle passager)',
    acces: 'public',
    corps: schemaInscription,
    exempleCorps: {
      nom_complet: 'Aimé Niyonkuru',
      email: 'aime@exemple.bi',
      telephone: '+25779000000',
      mot_de_passe: 'MotDePasse123',
    },
    statut: 201,
    erreurs: [409, 429],
  },
  {
    methode: 'post',
    chemin: '/auth/login',
    tag: 'Authentification',
    resume: 'Connexion : jeton d’accès (15 min) et jeton de rafraîchissement',
    acces: 'public',
    corps: schemaConnexion,
    exempleCorps: { email: 'admin@twende.test', mot_de_passe: 'Twende#2026' },
    erreurs: [429],
  },
  {
    methode: 'post',
    chemin: '/auth/refresh',
    tag: 'Authentification',
    resume: 'Nouveau jeton d’accès (le jeton de rafraîchissement change à chaque usage)',
    acces: 'public',
    corps: schemaJetonRafraichissement,
    exempleCorps: { jeton_rafraichissement: '{{jeton_rafraichissement}}' },
    erreurs: [429],
  },
  {
    methode: 'post',
    chemin: '/auth/logout',
    tag: 'Authentification',
    resume: 'Déconnexion : révoque le jeton de rafraîchissement',
    acces: 'connecte',
    corps: schemaJetonRafraichissement,
    exempleCorps: { jeton_rafraichissement: '{{jeton_rafraichissement}}' },
  },
  {
    methode: 'get',
    chemin: '/auth/me',
    tag: 'Authentification',
    resume: 'Profil de l’utilisateur connecté',
    acces: 'connecte',
  },

  // ---------- Stations ----------
  {
    methode: 'get',
    chemin: '/stations',
    tag: 'Stations',
    resume: 'Liste des stations (recherche, pagination)',
    acces: 'public',
    requete: schemaRechercheStations,
    exempleRequete: { ville: 'Bujumbura', limite: '10' },
    liste: true,
  },
  {
    methode: 'get',
    chemin: '/stations/{id}',
    tag: 'Stations',
    resume: 'Détail d’une station',
    acces: 'public',
  },
  {
    methode: 'post',
    chemin: '/stations',
    tag: 'Stations',
    resume: 'Créer une station',
    acces: 'admin',
    corps: schemaCreationStation,
    exempleCorps: STATION,
    statut: 201,
  },
  {
    methode: 'patch',
    chemin: '/stations/{id}',
    tag: 'Stations',
    resume: 'Modifier une station',
    acces: 'admin',
    corps: schemaModificationStation,
    exempleCorps: { nom: 'Gare routière de Ngagara' },
  },
  {
    methode: 'delete',
    chemin: '/stations/{id}',
    tag: 'Stations',
    resume: 'Supprimer une station (409 si elle est utilisée)',
    acces: 'admin',
    statut: 204,
    erreurs: [409],
  },

  // ---------- Véhicules ----------
  {
    methode: 'get',
    chemin: '/vehicules',
    tag: 'Véhicules',
    resume: 'Liste des véhicules (recherche, état, pagination)',
    acces: 'personnel',
    requete: schemaRechercheVehicules,
    exempleRequete: { active: 'true' },
    liste: true,
  },
  {
    methode: 'get',
    chemin: '/vehicules/{id}',
    tag: 'Véhicules',
    resume: 'Détail d’un véhicule',
    acces: 'personnel',
  },
  {
    methode: 'post',
    chemin: '/vehicules',
    tag: 'Véhicules',
    resume: 'Créer un véhicule',
    acces: 'admin',
    corps: schemaCreationVehicule,
    exempleCorps: { immatriculation: 'BJ-1234-A', modele: 'Yutong ZK6122', nombre_places: 49 },
    statut: 201,
    erreurs: [409],
  },
  {
    methode: 'patch',
    chemin: '/vehicules/{id}',
    tag: 'Véhicules',
    resume: 'Modifier un véhicule',
    acces: 'admin',
    corps: schemaModificationVehicule,
    exempleCorps: { active: false },
    erreurs: [409],
  },
  {
    methode: 'delete',
    chemin: '/vehicules/{id}',
    tag: 'Véhicules',
    resume: 'Supprimer un véhicule (409 s’il a des trajets)',
    acces: 'admin',
    statut: 204,
    erreurs: [409],
  },

  // ---------- Lignes ----------
  {
    methode: 'get',
    chemin: '/lignes',
    tag: 'Lignes',
    resume: 'Liste des lignes (recherche, état, pagination)',
    acces: 'public',
    requete: schemaRechercheLignes,
    exempleRequete: { active: 'true' },
    liste: true,
  },
  {
    methode: 'get',
    chemin: '/lignes/{id}',
    tag: 'Lignes',
    resume: 'Détail d’une ligne avec ses arrêts (dans l’ordre) et ses tarifs',
    acces: 'public',
  },
  {
    methode: 'post',
    chemin: '/lignes',
    tag: 'Lignes',
    resume: 'Créer une ligne',
    acces: 'admin',
    corps: schemaCreationLigne,
    exempleCorps: { code: 'BJM-GTG', nom: 'Bujumbura - Gitega' },
    statut: 201,
    erreurs: [409],
  },
  {
    methode: 'patch',
    chemin: '/lignes/{id}',
    tag: 'Lignes',
    resume: 'Modifier une ligne',
    acces: 'admin',
    corps: schemaModificationLigne,
    exempleCorps: { nom: 'Bujumbura - Gitega (direct)' },
    erreurs: [409],
  },
  {
    methode: 'delete',
    chemin: '/lignes/{id}',
    tag: 'Lignes',
    resume: 'Supprimer une ligne (409 si elle a des trajets)',
    acces: 'admin',
    statut: 204,
    erreurs: [409],
  },
  {
    methode: 'put',
    chemin: '/lignes/{id}/arrets',
    tag: 'Lignes',
    resume: 'Remplacer tous les arrêts (l’ordre du tableau = l’ordre sur la ligne)',
    acces: 'admin',
    corps: schemaArrets,
    exempleCorps: {
      arrets: [
        { station_id: 1, distance_km: 0, minutes_depuis_origine: 0 },
        { station_id: 2, distance_km: 30, minutes_depuis_origine: 45 },
        { station_id: 3, distance_km: 100, minutes_depuis_origine: 120 },
      ],
    },
  },
  {
    methode: 'put',
    chemin: '/lignes/{id}/tarifs',
    tag: 'Lignes',
    resume: 'Remplacer tous les tarifs (chaque tronçon va vers l’avant sur la ligne)',
    acces: 'admin',
    corps: schemaTarifs,
    exempleCorps: {
      tarifs: [
        { station_depart_id: 1, station_arrivee_id: 2, prix: 3000 },
        { station_depart_id: 1, station_arrivee_id: 3, prix: 7500 },
      ],
    },
  },

  // ---------- Trajets ----------
  {
    methode: 'get',
    chemin: '/trajets/recherche',
    tag: 'Trajets',
    resume: 'Recherche publique de trajets (filtres, tri, pagination). Heures du Burundi (UTC+2)',
    acces: 'public',
    requete: schemaRechercheTrajets,
    obligatoires: ['depart', 'arrivee'],
    exempleRequete: { depart: '1', arrivee: '2', date: '2026-11-20', tri: 'prix', limite: '10' },
    liste: true,
  },
  {
    methode: 'get',
    chemin: '/trajets',
    tag: 'Trajets',
    resume: 'Liste des trajets pour le personnel',
    acces: 'personnel',
    requete: schemaListeTrajets,
    exempleRequete: { statut: 'planifie', du: '2026-11-01' },
    liste: true,
  },
  {
    methode: 'get',
    chemin: '/trajets/{id}',
    tag: 'Trajets',
    resume: 'Détail d’un trajet (ligne, arrêts, véhicule, places libres)',
    acces: 'public',
  },
  {
    methode: 'get',
    chemin: '/trajets/{id}/places',
    tag: 'Trajets',
    resume: 'Plan des places : chaque place est libre ou occupée',
    acces: 'public',
  },
  {
    methode: 'get',
    chemin: '/trajets/{id}/remplissage',
    tag: 'Statistiques',
    resume: 'Taux de remplissage d’un trajet',
    acces: 'personnel',
  },
  {
    methode: 'post',
    chemin: '/trajets',
    tag: 'Trajets',
    resume: 'Planifier un trajet (l’arrivée est calculée si absente)',
    acces: 'admin',
    corps: schemaCreationTrajet,
    exempleCorps: { ligne_id: 1, vehicule_id: 1, depart_prevu: '2026-12-01T05:00:00Z' },
    statut: 201,
    erreurs: [409],
  },
  {
    methode: 'patch',
    chemin: '/trajets/{id}',
    tag: 'Trajets',
    resume: 'Modifier un trajet (annuler un trajet annule ses réservations)',
    acces: 'admin',
    corps: schemaModificationTrajet,
    exempleCorps: { statut: 'annule' },
    erreurs: [409],
  },
  {
    methode: 'delete',
    chemin: '/trajets/{id}',
    tag: 'Trajets',
    resume: 'Supprimer un trajet (409 s’il a des réservations)',
    acces: 'admin',
    statut: 204,
    erreurs: [409],
  },

  // ---------- Réservations ----------
  {
    methode: 'post',
    chemin: '/reservations',
    tag: 'Réservations',
    resume:
      'Réserver une ou plusieurs places (tout ou rien). 409 PLACE_DEJA_PRISE si une place est prise',
    acces: 'connecte',
    corps: schemaCreationReservation,
    exempleCorps: {
      trajet_id: 1,
      station_depart_id: 1,
      station_arrivee_id: 2,
      places: [{ numero_place: 12, passager: PASSAGER }],
    },
    statut: 201,
    erreurs: [409, 429],
  },
  {
    methode: 'get',
    chemin: '/reservations',
    tag: 'Réservations',
    resume: 'Mes réservations (le personnel voit toutes les réservations)',
    acces: 'connecte',
    requete: schemaListeReservations,
    exempleRequete: { statut_paiement: 'en_attente' },
    liste: true,
  },
  {
    methode: 'get',
    chemin: '/reservations/{id}',
    tag: 'Réservations',
    resume: 'Détail d’une réservation avec ses billets (404 si elle appartient à un autre)',
    acces: 'connecte',
  },
  {
    methode: 'post',
    chemin: '/reservations/{id}/annuler',
    tag: 'Réservations',
    resume: 'Annuler (passager : au moins 2 h avant le départ). Libère les places',
    acces: 'connecte',
    erreurs: [409],
  },
  {
    methode: 'patch',
    chemin: '/reservations/{id}/paiement',
    tag: 'Réservations',
    resume: 'Marquer la réservation comme payée',
    acces: 'personnel',
    erreurs: [409],
  },

  // ---------- Passagers ----------
  {
    methode: 'get',
    chemin: '/passagers',
    tag: 'Passagers',
    resume: 'Clients du guichet (recherche par nom ou téléphone)',
    acces: 'personnel',
    requete: schemaRecherchePassagers,
    exempleRequete: { q: 'aimé' },
    liste: true,
  },
  {
    methode: 'get',
    chemin: '/passagers/{id}',
    tag: 'Passagers',
    resume: 'Détail d’un passager',
    acces: 'personnel',
  },
  {
    methode: 'post',
    chemin: '/passagers',
    tag: 'Passagers',
    resume: 'Créer un client du guichet',
    acces: 'personnel',
    corps: schemaCreationPassager,
    exempleCorps: { ...PASSAGER, email: 'aime@exemple.bi' },
    statut: 201,
  },
  {
    methode: 'patch',
    chemin: '/passagers/{id}',
    tag: 'Passagers',
    resume: 'Modifier un passager',
    acces: 'personnel',
    corps: schemaModificationPassager,
    exempleCorps: { telephone: '+25779111111' },
  },
  {
    methode: 'delete',
    chemin: '/passagers/{id}',
    tag: 'Passagers',
    resume: 'Supprimer un passager (409 s’il a des billets)',
    acces: 'admin',
    statut: 204,
    erreurs: [409],
  },

  // ---------- Statistiques ----------
  {
    methode: 'get',
    chemin: '/statistiques/remplissage',
    tag: 'Statistiques',
    resume: 'Taux de remplissage par trajet, avec un résumé sur la période',
    acces: 'personnel',
    requete: schemaRemplissage,
    exempleRequete: { du: '2026-11-01', au: '2026-11-30' },
    liste: true,
  },

  // ---------- Outils ----------
  {
    methode: 'get',
    chemin: '/health',
    tag: 'Outils',
    resume: 'L’API répond',
    acces: 'public',
  },
];
