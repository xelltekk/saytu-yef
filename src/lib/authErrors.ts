type AuthErrorLike = {
  code?: string
  message?: string
}

function normalizeAuthError(error: AuthErrorLike | string) {
  if (typeof error === 'string') {
    return error.toLowerCase()
  }

  const code = error.code?.toLowerCase() ?? ''
  const message = error.message?.toLowerCase() ?? ''
  return `${code} ${message}`.trim()
}

export function getLoginErrorMessage(error: AuthErrorLike | string) {
  const normalized = normalizeAuthError(error)

  if (normalized.includes('invalid login credentials') || normalized.includes('invalid credentials')) {
    return 'Email ou mot de passe incorrect.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'Veuillez confirmer votre email avant de vous connecter.'
  }

  if (normalized.includes('rate limit') || normalized.includes('too many')) {
    return 'Trop de tentatives. Patientez quelques minutes puis reessayez.'
  }

  return 'Impossible de se connecter pour le moment. Verifiez votre connexion et reessayez.'
}

export function getSignupErrorResponse(error: AuthErrorLike): { message: string; status: number } {
  const normalized = normalizeAuthError(error)

  if (normalized.includes('user already registered') || normalized.includes('already registered')) {
    return { message: 'Cet email est deja utilise. Connectez-vous.', status: 409 }
  }

  if (normalized.includes('over_email_send_rate_limit') || normalized.includes('email rate limit')) {
    return {
      message:
        "Les emails de confirmation sont temporairement limites. Reessayez plus tard ou contactez l'administrateur pour activer le compte.",
      status: 429,
    }
  }

  if (normalized.includes('signup is disabled') || normalized.includes('signups not allowed')) {
    return {
      message: "L'inscription est temporairement desactivee. Contactez l'administrateur.",
      status: 503,
    }
  }

  if (normalized.includes('invalid email')) {
    return { message: 'Adresse email invalide.', status: 400 }
  }

  if (normalized.includes('password')) {
    return { message: 'Le mot de passe ne respecte pas les exigences de securite.', status: 400 }
  }

  return { message: 'Impossible de creer le compte pour le moment. Reessayez.', status: 400 }
}

export function getPasswordResetRequestErrorMessage(error: AuthErrorLike | string) {
  const normalized = normalizeAuthError(error)

  if (normalized.includes('rate limit') || normalized.includes('too many')) {
    return 'Trop de demandes en peu de temps. Patientez quelques minutes puis reessayez.'
  }

  if (normalized.includes('invalid email')) {
    return 'Adresse email invalide.'
  }

  return "Une erreur est survenue. Verifiez l'adresse email et reessayez."
}

export function getPasswordUpdateErrorMessage(error: AuthErrorLike | string) {
  const normalized = normalizeAuthError(error)

  if (normalized.includes('same password')) {
    return "Choisissez un mot de passe different de l'ancien."
  }

  if (normalized.includes('password')) {
    return 'Le mot de passe ne respecte pas les exigences de securite.'
  }

  if (normalized.includes('session') || normalized.includes('expired') || normalized.includes('token')) {
    return 'Erreur lors de la mise a jour. Le lien a peut-etre expire.'
  }

  return 'Erreur lors de la mise a jour du mot de passe. Reessayez.'
}
