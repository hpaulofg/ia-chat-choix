import { THEME_STORAGE_KEY } from "@/lib/chat-storage-keys";

/** Script inline no servidor: aplica tema antes da hidratação (evita next/script + beforeInteractive). */
export default function ThemeScript() {
  const __html = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var v=localStorage.getItem(k);document.documentElement.classList.toggle("dark",v!=="light");}catch(e){document.documentElement.classList.add("dark");}})();`;

  return (
    <script id="theme-bootstrap" dangerouslySetInnerHTML={{ __html }} />
  );
}
