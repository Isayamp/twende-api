// Erreurs que l'application sait expliquer au client.
// Chaque erreur a un code HTTP, un code court lisible par un programme et un message.

export interface DetailErreur {
  champ: string;
  message: string;
}

export class ErreurApp extends Error {
  constructor(
    public readonly statut: number,
    public readonly code: string,
    message: string,
    public readonly details?: DetailErreur[],
  ) {
    super(message);
    this.name = 'ErreurApp';
  }
}

/** 400 : la requête est mal formée. */
export class RequeteInvalide extends ErreurApp {
  constructor(code: string, message: string) {
    super(400, code, message);
  }
}

/** 401 : pas connecté, ou jeton invalide. */
export class NonAuthentifie extends ErreurApp {
  constructor(message = 'Connexion requise.') {
    super(401, 'NON_AUTHENTIFIE', message);
  }
}

/** 403 : connecté, mais sans le droit. */
export class Interdit extends ErreurApp {
  constructor(message = "Vous n'avez pas le droit de faire cette action.") {
    super(403, 'INTERDIT', message);
  }
}

/** 404 : la ressource n'existe pas. */
export class NonTrouve extends ErreurApp {
  constructor(message = 'Ressource introuvable.') {
    super(404, 'NON_TROUVE', message);
  }
}

/** 409 : conflit (place déjà prise, élément encore utilisé...). */
export class Conflit extends ErreurApp {
  constructor(code: string, message: string) {
    super(409, code, message);
  }
}

/** 422 : données lisibles mais invalides. */
export class ValidationEchouee extends ErreurApp {
  constructor(details: DetailErreur[], message = 'Les données envoyées sont invalides.') {
    super(422, 'VALIDATION', message, details);
  }
}
