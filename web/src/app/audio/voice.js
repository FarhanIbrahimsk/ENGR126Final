// Spoken feedback for Live Set, using the browser's built-in text-to-speech.

// Short enough to finish before the next rep. Keys match RULE_FLAGS in shared/contract.js.
export const FLAG_PHRASES = {
  shallow: "Too shallow",
  excessive_lean: "Too much lean",
  body_bend: "Keep your body straight",
  no_lockout: "Lock out",
};

export const TRACKING_LOST_PHRASE = "I can't see you";

const STORAGE_KEY = "voiceFeedback";

/**
 * One message per rep: the first problem if there is one, otherwise the count.
 * @param {object} rep a contract Rep
 * @param {number} successCount successful reps so far, including this one
 */
export function phraseFor(rep, successCount) {
  if (rep.ruleFlags.length) return FLAG_PHRASES[rep.ruleFlags[0]] ?? "Check your form";
  if (rep.classifier?.label === "bad") return "Check your form";
  return String(successCount);
}

// Storage can be blocked, for example in some private browsing modes.
function loadEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function createVoice() {
  const supported = "speechSynthesis" in window;
  let enabled = loadEnabled();

  const stop = () => {
    if (supported) speechSynthesis.cancel();
  };

  // A new message replaces the old one, so the voice never falls behind the lifter.
  const say = (text) => {
    if (!supported || !enabled) return;
    if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    speechSynthesis.speak(utterance);
  };

  const setEnabled = (value) => {
    enabled = value;
    if (!enabled) stop();
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    } catch {
      // The choice just won't be remembered.
    }
  };

  return { supported, say, stop, setEnabled, isEnabled: () => enabled };
}
