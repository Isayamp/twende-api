-- La devise par défaut devient le franc burundais (simulation Burundi).
ALTER TABLE "tarif" ALTER COLUMN "devise" SET DEFAULT 'BIF';
ALTER TABLE "reservation" ALTER COLUMN "devise" SET DEFAULT 'BIF';
