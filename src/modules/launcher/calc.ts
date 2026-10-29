/**
 * A small calculator for the launcher: + − × ÷ ^ and parentheses, with a
 * dot or a comma for decimals ("3,5 * 2"). Null for anything that is not a
 * calculation, so typing an app name never shows a result.
 */
export function calculate(input: string): number | null {
  const text = input.replace(/\s+/g, "");
  // Digits and operators only, with at least one operator between numbers.
  if (!/^[\d.,+\-*/x×÷^()]+$/i.test(text) || !/\d[+\-*/x×÷^]|\)[+\-*/x×÷^(]|\d\(/i.test(text)) return null;
  let pos = 0;

  const peek = () => text[pos];
  const eat = (chars: string) => {
    if (pos < text.length && chars.includes(text[pos].toLowerCase())) return text[pos++];
    return null;
  };

  function number(): number | null {
    const start = pos;
    while (pos < text.length && /[\d.,]/.test(text[pos])) pos++;
    const raw = text.slice(start, pos).replace(",", ".");
    if (!raw || (raw.match(/\./g)?.length ?? 0) > 1) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  function primary(): number | null {
    if (eat("(")) {
      const value = expression();
      return value !== null && eat(")") ? value : null;
    }
    return number();
  }

  function unary(): number | null {
    if (eat("-")) {
      const value = unary();
      return value === null ? null : -value;
    }
    if (eat("+")) return unary();
    return power();
  }

  function power(): number | null {
    const base = primary();
    if (base === null) return null;
    if (eat("^")) {
      const exponent = unary();
      return exponent === null ? null : base ** exponent;
    }
    return base;
  }

  function term(): number | null {
    let value = unary();
    while (value !== null) {
      // Implicit product: "2(3+4)".
      if (peek() === "(") {
        const right = unary();
        value = right === null ? null : value * right;
        continue;
      }
      const op = eat("*x×/÷");
      if (!op) break;
      const right = unary();
      if (right === null) return null;
      value = op === "/" || op === "÷" ? value / right : value * right;
    }
    return value;
  }

  function expression(): number | null {
    let value = term();
    while (value !== null) {
      const op = eat("+-");
      if (!op) break;
      const right = term();
      if (right === null) return null;
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }

  const result = expression();
  return result !== null && pos === text.length && Number.isFinite(result) ? result : null;
}

/** "1 234,5": the way French writes numbers, up to 10 decimals. */
export function formatNumber(value: number): string {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 10 });
}
