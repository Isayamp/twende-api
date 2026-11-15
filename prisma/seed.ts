// Jeu de données de test (seeder). On peut le relancer sans créer de doublons.
// Les distances et les prix sont fictifs : ils servent seulement à la démonstration.
// Aucun mot de passe de base de données ici : DATABASE_URL vient du fichier .env.
import { existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

if (existsSync('.env')) process.loadEnvFile('.env');

const prisma = new PrismaClient();

// Mot de passe des comptes de test (valeur de démonstration, pas un vrai secret).
const MOT_DE_PASSE_TEST = process.env.SEED_MOT_DE_PASSE ?? 'Twende#2026';
const TARIF_CENTS_PAR_KM = 12; // 0,12 USD par km, calculé en centimes entiers
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
  { nom: 'Gare routière de Goma', ville: 'Goma', pays: 'RD Congo' },
  { nom: 'Gare routière de Rubavu', ville: 'Rubavu', pays: 'Rwanda' },
  { nom: 'Gare routière de Nyabugogo', ville: 'Kigali', pays: 'Rwanda' },
  { nom: 'Gare routière de Huye', ville: 'Huye', pays: 'Rwanda' },
  { nom: 'Gare routière de Bukavu', ville: 'Bukavu', pays: 'RD Congo' },
  { nom: "Gare routière d'Uvira", ville: 'Uvira', pays: 'RD Congo' },
  { nom: 'Gare routière de Bujumbura', ville: 'Bujumbura', pays: 'Burundi' },
];

const LIGNES: LigneSeed[] = [
  {
    code: 'GOM-KGL',
    nom: 'Goma - Kigali',
    arrets: [
      { ville: 'Goma', dixiemesKm: 0, minutes: 0 },
      { ville: 'Rubavu', dixiemesKm: 50, minutes: 30 },
      { ville: 'Kigali', dixiemesKm: 1600, minutes: 240 },
    ],
  },
  {
    code: 'BKV-BJM',
    nom: 'Bukavu - Bujumbura',
    arrets: [
      { ville: 'Bukavu', dixiemesKm: 0, minutes: 0 },
      { ville: 'Uvira', dixiemesKm: 1200, minutes: 210 },
      { ville: 'Bujumbura', dixiemesKm: 1450, minutes: 270 },
    ],
  },
  {
    code: 'KGL-BJM',
    nom: 'Kigali - Bujumbura',
    arrets: [
      { ville: 'Kigali', dixiemesKm: 0, minutes: 0 },
      { ville: 'Huye', dixiemesKm: 1300, minutes: 150 },
      { ville: 'Bujumbura', dixiemesKm: 2700, minutes: 330 },
    ],
  },
];

const VEHICULES = [
  { immatriculation: 'RAB-101-A', modele: 'Yutong ZK6129', nombre_places: 49 },
  { immatriculation: 'RAB-102-A', modele: 'Yutong ZK6129', nombre_places: 49 },
  { immatriculation: 'CGO-201-B', modele: 'Higer KLQ6129', nombre_places: 45 },
  { immatriculation: 'CGO-202-B', modele: 'Higer KLQ6129', nombre_places: 45 },
  { immatriculation: 'BDI-301-C', modele: 'Toyota Coaster', nombre_places: 30 },
  { immatriculation: 'BDI-302-C', modele: 'Toyota Coaster', nombre_places: 30 },
];

// Horaires de départ (heure UTC) : deux départs par jour pour chaque ligne.
const HEURES_DEPART = [7, 14];

/** Transforme un montant en centimes entiers en texte décimal, par exemple 1950 -> "19.50". */
function centimesEnTexte(centimes: number): string {
  const entier = Math.floor(centimes / 100);
  const reste = String(centimes % 100).padStart(2, '0');
  return `${entier}.${reste}`;
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
    { nom_complet: 'Amani Kasongo', email: 'passager@twende.test', role: 'passager' as const },
    { nom_complet: 'Neema Uwase', email: 'passager2@twende.test', role: 'passager' as const },
  ];
  for (const compte of comptes) {
    await prisma.utilisateur.upsert({
      where: { email: compte.email },
      update: {},
      create: { ...compte, telephone: '+243990000000', mot_de_passe_hash: hash },
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

  // Un tarif pour chaque couple (départ avant arrivée) : 0,12 USD par km.
  for (let i = 0; i < ligne.arrets.length; i++) {
    for (let j = i + 1; j < ligne.arrets.length; j++) {
      const km10 = ligne.arrets[j].dixiemesKm - ligne.arrets[i].dixiemesKm;
      const centimes = Math.round((km10 * TARIF_CENTS_PAR_KM) / 10);
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
          prix: centimesEnTexte(centimes),
          devise: 'USD',
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
