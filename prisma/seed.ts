// Jeu de données de test (seeder). On peut le relancer sans créer de doublons.
// Simulation : réseau de bus au départ de Bujumbura (Burundi), prix en francs burundais (BIF).
// Les distances, les horaires et les prix sont fictifs : ils servent seulement à la démonstration.
// Aucun mot de passe de base de données ici : DATABASE_URL vient du fichier .env.
import { existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

if (existsSync('.env')) process.loadEnvFile('.env');

const prisma = new PrismaClient();

// Mot de passe des comptes de test (valeur de démonstration, pas un vrai secret).
const MOT_DE_PASSE_TEST = process.env.SEED_MOT_DE_PASSE ?? 'Twende#2026';
const DEVISE = 'BIF';
const TARIF_BIF_PAR_KM = 90; // prix de base par km
const ARRONDI_BIF = 500; // les billets sont arrondis à 500 BIF près
const JOURS_DE_TRAJETS = 7;

interface ArretSeed {
  ville: string;
  dixiemesKm: number; // distance depuis l'origine, en dixièmes de km (évite les flottants)
  minutes: number;
}

interface LigneSeed {
  code: string;
  nom: string;
  arrets: ArretSeed[];
}

const STATIONS = [
  { nom: 'Gare routière de Bujumbura', ville: 'Bujumbura', pays: 'Burundi' },
  { nom: 'Gare routière de Muramvya', ville: 'Muramvya', pays: 'Burundi' },
  { nom: 'Gare routière de Gitega', ville: 'Gitega', pays: 'Burundi' },
  { nom: 'Gare routière de Kayanza', ville: 'Kayanza', pays: 'Burundi' },
  { nom: 'Gare routière de Ngozi', ville: 'Ngozi', pays: 'Burundi' },
  { nom: 'Gare routière de Rumonge', ville: 'Rumonge', pays: 'Burundi' },
  { nom: 'Gare routière de Makamba', ville: 'Makamba', pays: 'Burundi' },
  { nom: 'Gare routière de Cibitoke', ville: 'Cibitoke', pays: 'Burundi' },
];

const LIGNES: LigneSeed[] = [
  {
    code: 'BJM-GTG',
    nom: 'Bujumbura - Gitega',
    arrets: [
      { ville: 'Bujumbura', dixiemesKm: 0, minutes: 0 },
      { ville: 'Muramvya', dixiemesKm: 480, minutes: 60 },
      { ville: 'Gitega', dixiemesKm: 1000, minutes: 120 },
    ],
  },
  {
    code: 'BJM-NGZ',
    nom: 'Bujumbura - Ngozi',
    arrets: [
      { ville: 'Bujumbura', dixiemesKm: 0, minutes: 0 },
      { ville: 'Muramvya', dixiemesKm: 480, minutes: 60 },
      { ville: 'Kayanza', dixiemesKm: 900, minutes: 110 },
      { ville: 'Ngozi', dixiemesKm: 1250, minutes: 150 },
    ],
  },
  {
    code: 'BJM-MKB',
    nom: 'Bujumbura - Makamba (route du lac)',
    arrets: [
      { ville: 'Bujumbura', dixiemesKm: 0, minutes: 0 },
      { ville: 'Rumonge', dixiemesKm: 750, minutes: 90 },
      { ville: 'Makamba', dixiemesKm: 1400, minutes: 180 },
    ],
  },
  {
    code: 'BJM-CBT',
    nom: 'Bujumbura - Cibitoke',
    arrets: [
      { ville: 'Bujumbura', dixiemesKm: 0, minutes: 0 },
      { ville: 'Cibitoke', dixiemesKm: 600, minutes: 90 },
    ],
  },
];

// Deux véhicules par ligne (voir creerTrajets).
const VEHICULES = [
  { immatriculation: 'A-1201-B', modele: 'Yutong ZK6129', nombre_places: 49 },
  { immatriculation: 'A-1202-B', modele: 'Yutong ZK6129', nombre_places: 49 },
  { immatriculation: 'A-2301-C', modele: 'Higer KLQ6129', nombre_places: 45 },
  { immatriculation: 'A-2302-C', modele: 'Higer KLQ6129', nombre_places: 45 },
  { immatriculation: 'A-3401-D', modele: 'Toyota Coaster', nombre_places: 30 },
  { immatriculation: 'A-3402-D', modele: 'Toyota Coaster', nombre_places: 30 },
  { immatriculation: 'A-4501-E', modele: 'Toyota Coaster', nombre_places: 30 },
  { immatriculation: 'A-4502-E', modele: 'Toyota Coaster', nombre_places: 30 },
];

// Départs à 07h00 et 14h00, heure du Burundi (UTC+2), donc 05h00 et 12h00 en UTC.
const HEURES_DEPART = [5, 12];

/**
 * Prix d'un tronçon en BIF, avec des entiers seulement (pas de flottant).
 * Exemple : 100,0 km -> 1000 dixièmes -> 1000 x 90 / 10 = 9000, arrondi à 500 près -> "9000.00".
 */
function prixTroncon(dixiemesKm: number): string {
  const brut = (dixiemesKm * TARIF_BIF_PAR_KM) / 10;
  const arrondi = Math.max(ARRONDI_BIF, Math.round(brut / ARRONDI_BIF) * ARRONDI_BIF);
  return `${arrondi}.00`;
}

/** Texte décimal d'une distance donnée en dixièmes de km, par exemple 1600 -> "160.0". */
function dixiemesEnTexte(dixiemes: number): string {
  return `${Math.floor(dixiemes / 10)}.${dixiemes % 10}`;
}

async function creerComptes(): Promise<void> {
  const hash = await bcrypt.hash(MOT_DE_PASSE_TEST, 10);
  const comptes = [
    { nom_complet: 'Administrateur Twende', email: 'admin@twende.test', role: 'admin' as const },
    { nom_complet: 'Agent de guichet', email: 'agent@twende.test', role: 'agent' as const },
    { nom_complet: 'Aimé Niyonkuru', email: 'passager@twende.test', role: 'passager' as const },
    {
      nom_complet: 'Chantal Ndayishimiye',
      email: 'passager2@twende.test',
      role: 'passager' as const,
    },
  ];
  for (const compte of comptes) {
    await prisma.utilisateur.upsert({
      where: { email: compte.email },
      update: {},
      create: { ...compte, telephone: '+25779000000', mot_de_passe_hash: hash },
    });
  }
}

async function creerStations(): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  for (const station of STATIONS) {
    const creee = await prisma.station.upsert({
      where: { nom_ville: { nom: station.nom, ville: station.ville } },
      update: {},
      create: station,
    });
    ids.set(station.ville, creee.id_station);
  }
  return ids;
}

async function creerLigne(ligne: LigneSeed, stations: Map<string, number>): Promise<number> {
  const creee = await prisma.ligne.upsert({
    where: { code: ligne.code },
    update: {},
    create: { code: ligne.code, nom: ligne.nom },
  });

  // Arrêts dans l'ordre.
  for (const [index, arret] of ligne.arrets.entries()) {
    const station_id = stations.get(arret.ville)!;
    await prisma.ligneStation.upsert({
      where: { ligne_id_station_id: { ligne_id: creee.id_ligne, station_id } },
      update: {},
      create: {
        ligne_id: creee.id_ligne,
        station_id,
        ordre: index + 1,
        distance_km: dixiemesEnTexte(arret.dixiemesKm),
        minutes_depuis_origine: arret.minutes,
      },
    });
  }

  // Un tarif pour chaque couple (départ avant arrivée) : environ 90 BIF par km.
  for (let i = 0; i < ligne.arrets.length; i++) {
    for (let j = i + 1; j < ligne.arrets.length; j++) {
      const km10 = ligne.arrets[j].dixiemesKm - ligne.arrets[i].dixiemesKm;
      await prisma.tarif.upsert({
        where: {
          ligne_id_station_depart_id_station_arrivee_id: {
            ligne_id: creee.id_ligne,
            station_depart_id: stations.get(ligne.arrets[i].ville)!,
            station_arrivee_id: stations.get(ligne.arrets[j].ville)!,
          },
        },
        update: {},
        create: {
          ligne_id: creee.id_ligne,
          station_depart_id: stations.get(ligne.arrets[i].ville)!,
          station_arrivee_id: stations.get(ligne.arrets[j].ville)!,
          prix: prixTroncon(km10),
          devise: DEVISE,
        },
      });
    }
  }
  return creee.id_ligne;
}

async function creerVehicules(): Promise<number[]> {
  const ids: number[] = [];
  for (const vehicule of VEHICULES) {
    const cree = await prisma.vehicule.upsert({
      where: { immatriculation: vehicule.immatriculation },
      update: {},
      create: vehicule,
    });
    ids.push(cree.id_vehicule);
  }
  return ids;
}

// Crée les trajets des prochains jours. Chaque ligne a ses deux véhicules,
// donc un véhicule n'a jamais deux trajets qui se chevauchent.
async function creerTrajets(lignes: LigneSeed[], idsLignes: number[], idsVehicules: number[]) {
  const aujourdhui = new Date();
  aujourdhui.setUTCHours(0, 0, 0, 0);

  for (const [indexLigne, ligne] of lignes.entries()) {
    const dureeMinutes = ligne.arrets[ligne.arrets.length - 1].minutes;
    for (let jour = 1; jour <= JOURS_DE_TRAJETS; jour++) {
      for (const [indexHeure, heure] of HEURES_DEPART.entries()) {
        const depart = new Date(aujourdhui);
        depart.setUTCDate(depart.getUTCDate() + jour);
        depart.setUTCHours(heure, 0, 0, 0);
        const arrivee = new Date(depart.getTime() + dureeMinutes * 60 * 1000);

        const existe = await prisma.trajet.findFirst({
          where: { ligne_id: idsLignes[indexLigne], depart_prevu: depart },
        });
        if (existe) continue;

        await prisma.trajet.create({
          data: {
            ligne_id: idsLignes[indexLigne],
            vehicule_id: idsVehicules[indexLigne * 2 + indexHeure],
            depart_prevu: depart,
            arrivee_prevue: arrivee,
          },
        });
      }
    }
  }
}

async function main(): Promise<void> {
  await creerComptes();
  const stations = await creerStations();
  const idsLignes: number[] = [];
  for (const ligne of LIGNES) {
    idsLignes.push(await creerLigne(ligne, stations));
  }
  const idsVehicules = await creerVehicules();
  await creerTrajets(LIGNES, idsLignes, idsVehicules);
  console.info('Données de test créées.');
}

main()
  .catch((erreur) => {
    console.error('Échec du seeder :', erreur);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
