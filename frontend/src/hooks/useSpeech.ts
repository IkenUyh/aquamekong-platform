import { useCallback, useEffect, useRef, useState } from 'react';
import { pickVietnameseVoice } from '../utils/speech';

/** Chrome nạp danh sách giọng sau một lúc (voiceschanged); quá lâu chưa có giọng tiếng Việt thì coi như không có */
const VOICE_WAIT_MS = 2000;

export type SpeechStatus = 'loading' | 'ready' | 'unsupported';

const synth = (): SpeechSynthesis | null =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
    ? window.speechSynthesis : null;

/**
 * Đọc to bằng giọng tiếng Việt của máy (Web Speech API, không qua máy chủ). Không có speechSynthesis (WebView Android
 * của app thường không có) hoặc máy không có giọng tiếng Việt thì status = 'unsupported': ẩn nút đọc.
 * Một nút vừa đọc vừa dừng (toggle); rời trang thì dừng đọc.
 */
export function useSpeech() {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [status, setStatus] = useState<SpeechStatus>(() => (synth() ? 'loading' : 'unsupported'));
  const [speaking, setSpeaking] = useState(false);
  const ownUtterance = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const s = synth();
    if (!s) return;
    const pick = () => {
      const v = pickVietnameseVoice(s.getVoices());
      if (v) {
        setVoice(v);
        setStatus('ready');
      }
    };
    pick();
    s.addEventListener?.('voiceschanged', pick);
    const timer = window.setTimeout(() => setStatus((st) => (st === 'loading' ? 'unsupported' : st)), VOICE_WAIT_MS);
    return () => {
      s.removeEventListener?.('voiceschanged', pick);
      window.clearTimeout(timer);
      // Rời trang: dừng câu đang đọc của trang này
      if (ownUtterance.current) s.cancel();
    };
  }, []);

  const toggle = useCallback((text: string) => {
    const s = synth();
    if (!s || !voice) return;
    if (speaking || s.speaking) {
      ownUtterance.current = null;
      s.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.9;
    const done = () => {
      // Câu đã bị thay hoặc dừng tay: không đụng trạng thái của câu mới
      if (ownUtterance.current !== u) return;
      ownUtterance.current = null;
      setSpeaking(false);
    };
    u.onend = done;
    u.onerror = done;
    ownUtterance.current = u;
    s.cancel();
    s.speak(u);
    setSpeaking(true);
  }, [voice, speaking]);

  return { status, speaking, toggle };
}
