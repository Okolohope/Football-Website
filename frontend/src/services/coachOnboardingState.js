const storageKey = (userId) => `elevn:coach-onboarding-complete:${userId}`;

export function isCoachOnboardingComplete(userId) {
  if (!userId) return false;

  try {
    return window.localStorage.getItem(storageKey(userId)) === "true";
  } catch {
    return false;
  }
}

export function markCoachOnboardingComplete(userId) {
  if (!userId) return false;

  try {
    window.localStorage.setItem(storageKey(userId), "true");
    return true;
  } catch {
    return false;
  }
}

export function getCoachDestination(userId) {
  return isCoachOnboardingComplete(userId) ? "/coach" : "/coach/onboarding";
}