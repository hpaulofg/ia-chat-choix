"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

type SpeechRecInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((ev: SpeechResultsEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechResultsEvent = {
  results: {
    length: number;
    [i: number]: {
      isFinal: boolean;
      0: { transcript: string };
    };
  };
};

type SpeechRecCtor = new () => SpeechRecInstance;

function speechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecCtor;
    webkitSpeechRecognition?: SpeechRecCtor;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

const noopSubscribe = () => () => {};

export function useSpeechDictation(setInput: (value: string) => void) {
  const [listening, setListening] = useState(false);
  /** SSR + 1.º paint do cliente = false; depois da hidratação reflecte o browser (sem mismatch). */
  const supported = useSyncExternalStore(
    noopSubscribe,
    speechRecognitionSupported,
    () => false
  );

  const recRef = useRef<SpeechRecInstance | null>(null);
  const continueRef = useRef(false);
  const baseRef = useRef("");
  const lastDisplayRef = useRef("");
  const setInputRef = useRef(setInput);
  const attachRecRef = useRef<(rec: SpeechRecInstance) => void>(() => {});

  useEffect(() => {
    setInputRef.current = setInput;
  }, [setInput]);

  useLayoutEffect(() => {
    attachRecRef.current = (rec: SpeechRecInstance) => {
      rec.onresult = (event: SpeechResultsEvent) => {
        let finals = "";
        let interim = "";
        for (let i = 0; i < event.results.length; i++) {
          const r = event.results[i];
          const t = r[0]?.transcript ?? "";
          if (r.isFinal) finals += t;
          else interim += t;
        }
        const speech = finals + interim;
        const merged = baseRef.current + speech;
        lastDisplayRef.current = merged;
        setInputRef.current(merged);
      };

      rec.onerror = () => {
        continueRef.current = false;
        setListening(false);
        recRef.current = null;
      };

      rec.onend = () => {
        if (!continueRef.current) {
          setListening(false);
          recRef.current = null;
          return;
        }
        baseRef.current = lastDisplayRef.current;
        const w = window as Window & {
          SpeechRecognition?: SpeechRecCtor;
          webkitSpeechRecognition?: SpeechRecCtor;
        };
        const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
        if (!Ctor) {
          setListening(false);
          recRef.current = null;
          return;
        }
        try {
          const next = new Ctor();
          next.lang = "pt-BR";
          next.continuous = true;
          next.interimResults = true;
          attachRecRef.current(next);
          recRef.current = next;
          next.start();
        } catch {
          setListening(false);
          recRef.current = null;
        }
      };
    };
  }, []);

  const stop = useCallback(() => {
    continueRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      try {
        recRef.current?.abort?.();
      } catch {
        /* ignore */
      }
    }
    recRef.current = null;
    setListening(false);
  }, []);

  /**
   * Chamado quando o utilizador edita o textarea à mão durante o ditado.
   * Reinicia o reconhecimento para limpar resultados acumulados no browser (evita repor texto apagado).
   */
  const notifyUserEditedTranscript = useCallback(
    (value: string) => {
      if (!continueRef.current || !recRef.current) return;
      const prev = lastDisplayRef.current;
      if (value === prev) return;
      baseRef.current = value;
      lastDisplayRef.current = value;
      try {
        recRef.current.stop();
      } catch {
        try {
          recRef.current.abort?.();
        } catch {
          /* ignore */
        }
      }
    },
    []
  );

  const start = useCallback(
    (currentInput: string) => {
      if (typeof window === "undefined") return;
      const w = window as Window & {
        SpeechRecognition?: SpeechRecCtor;
        webkitSpeechRecognition?: SpeechRecCtor;
      };
      const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (!Ctor) return;

      stop();
      continueRef.current = true;
      baseRef.current = currentInput;
      lastDisplayRef.current = currentInput;

      const rec = new Ctor();
      rec.lang = "pt-BR";
      rec.continuous = true;
      rec.interimResults = true;
      attachRecRef.current(rec);
      recRef.current = rec;
      try {
        rec.start();
        setListening(true);
      } catch {
        continueRef.current = false;
        recRef.current = null;
        setListening(false);
      }
    },
    [stop]
  );

  return { supported, listening, start, stop, notifyUserEditedTranscript };
}
