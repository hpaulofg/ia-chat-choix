/** Saudação por hora local (costume em português). */
export function timeOfDayGreeting(date = new Date()): "Bom dia" | "Boa tarde" | "Boa noite" {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}
