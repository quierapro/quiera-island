import { describe, expect, it } from "vitest";
import { activeLine, fitFontSize, halfPhrases, lyricsKind, lyricsQuery, parseLrc, parseYrc, singingSpan, wordsSung } from "./lyrics";

const timesAndText = (lrc: string) => parseLrc(lrc).map(({ time, text }) => ({ time, text }));

describe("parseLrc", () => {
  it("reads timestamps and text", () => {
    expect(timesAndText("[00:31.48] Like the legend\n[00:35.40] All ends")).toEqual([
      { time: 31_480, text: "Like the legend" },
      { time: 35_400, text: "All ends" },
    ]);
  });

  it("keeps instrumental gaps as empty lines and skips metadata", () => {
    expect(timesAndText("[ar: Someone]\n[00:01.00]\n[01:02.5] Hi")).toEqual([
      { time: 1000, text: "" },
      { time: 62_500, text: "Hi" },
    ]);
  });

  it("expands lines with several stamps and sorts them", () => {
    expect(parseLrc("[00:20.00][00:05.00] Chorus").map((l) => l.time)).toEqual([5000, 20_000]);
  });

  it("applies the offset tag", () => {
    expect(parseLrc("[offset:500]\n[00:02.00] A")[0].time).toBe(1500);
  });

  it("uses word stamps when the source has them (enhanced LRC)", () => {
    const [line] = parseLrc("[00:10.00] <00:10.00> You <00:10.40> show <00:11.20> the lights");
    expect(line.text).toBe("You show the lights");
    expect(line.wordSync).toBe(true);
    expect(line.words).toEqual([
      { text: "You", time: 10_000 },
      { text: "show", time: 10_400 },
      { text: "the", time: 11_200 },
      { text: "lights", time: 11_200 },
    ]);
  });

  it("estimates word times otherwise", () => {
    const [line] = parseLrc("[00:10.00] You show\n[00:20.00] next");
    expect(line.wordSync).toBe(false);
    expect(line.words.map((w) => w.text)).toEqual(["You show"]);
    expect(line.words[0].time).toBe(10_000);
  });
});

describe("halfPhrases (no word timing)", () => {
  it("cuts after a comma near the middle", () => {
    const halves = halfPhrases("Maybe you can show me, how to love maybe", 0, 10_000);
    expect(halves.map((h) => h.text)).toEqual(["Maybe you can show me,", "how to love maybe"]);
  });

  it("cuts at the word boundary nearest the middle otherwise", () => {
    expect(halfPhrases("one two three four five six", 0, 10_000).map((h) => h.text)).toEqual([
      "one two three",
      "four five six",
    ]);
  });

  it("keeps short lines whole", () => {
    expect(halfPhrases("Oh my god", 1000, 5000)).toEqual([{ text: "Oh my god", time: 1000 }]);
  });

  it("starts the second half when the singing reaches it, before the next line", () => {
    const [a, b] = halfPhrases("one two three four five six", 1000, 10_000);
    expect(a.time).toBe(1000);
    expect(b.time).toBeGreaterThan(1000);
    expect(b.time).toBeLessThan(1000 + singingSpan("one two three four five six", 10_000));
  });

  it("is empty for an instrumental gap", () => {
    expect(halfPhrases("", 0, 1000)).toEqual([]);
  });
});

describe("parseYrc (NetEase word timing)", () => {
  const yrc = [
    '{"t":0,"c":[{"tx":"credits"}]}',
    "[24840,2520](24840,480,0)Think (25320,510,0)you're (25830,390,0)so (26220,1140,0)criminal",
    "[27500,1000](27500,300,0)(Oh) (27800,200,0)yeah",
  ].join("\n");

  it("reads the real time of every word and skips credit lines", () => {
    const lines = parseYrc(yrc);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ time: 24_840, text: "Think you're so criminal", wordSync: true });
    expect(lines[0].words.map((w) => w.time)).toEqual([24_840, 25_320, 25_830, 26_220]);
  });

  it("keeps parentheses that belong to the lyrics", () => {
    expect(parseYrc(yrc)[1].words.map((w) => w.text)).toEqual(["(Oh)", "yeah"]);
  });

  it("is a word-timed lyric", () => {
    expect(lyricsKind(parseYrc(yrc))).toBe("word");
    expect(lyricsKind(parseLrc("[00:01.00] one two three four five"))).toBe("phrase");
    expect(lyricsKind(null)).toBeNull();
  });
});

describe("activeLine and wordsSung", () => {
  const lines = parseLrc("[00:01.00] a b\n[00:05.00] c\n[00:09.00] d");

  it("is -1 before the first line", () => {
    expect(activeLine(lines, 500)).toBe(-1);
  });

  it("finds the line being sung", () => {
    expect(activeLine(lines, 1000)).toBe(0);
    expect(activeLine(lines, 7000)).toBe(1);
    expect(activeLine(lines, 99_000)).toBe(2);
  });

  it("counts the words already sung", () => {
    const [line] = parseYrc("[1000,2000](1000,400,0)a (1400,600,0)b");
    expect(wordsSung(line, 999)).toBe(0);
    expect(wordsSung(line, 1000)).toBe(1);
    expect(wordsSung(line, 1500)).toBe(2);
    expect(wordsSung(undefined, 4000)).toBe(0);
  });

  it("treats a short estimated line as one block", () => {
    expect(wordsSung(lines[0], 1000)).toBe(1);
    expect(lines[0].words).toHaveLength(1);
  });
});

describe("lyricsQuery", () => {
  it("leaves a clean title alone", () => {
    expect(lyricsQuery("Get Lucky", "Daft Punk")).toEqual({ track: "Get Lucky", artist: "Daft Punk" });
  });

  it("cleans and splits a YouTube video title", () => {
    expect(lyricsQuery("Daft Punk - Get Lucky (Official Video) [HD]", "DaftPunkVEVO")).toEqual({
      track: "Get Lucky",
      artist: "Daft Punk",
    });
  });

  it("drops featured artists and the Topic suffix", () => {
    expect(lyricsQuery("Song ft. Someone", "Artist - Topic")).toEqual({ track: "Song", artist: "Artist" });
  });

  it("keeps a music player's title and drops the version after the dash", () => {
    const spotify = "SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify";
    expect(lyricsQuery("Dancin - Krono Remix Slowed+Reverb", "Crimson Power", spotify)).toEqual({
      track: "Dancin",
      artist: "Crimson Power",
    });
    expect(lyricsQuery("Come Together - Remastered 2009", "The Beatles", spotify)).toEqual({
      track: "Come Together",
      artist: "The Beatles",
    });
    expect(lyricsQuery("Rock - Paper", "Band", spotify)).toEqual({ track: "Rock - Paper", artist: "Band" });
  });

  it("still splits a browser tab's title", () => {
    expect(lyricsQuery("Daft Punk - Get Lucky", "DaftPunkVEVO", "MSEdge")).toEqual({ track: "Get Lucky", artist: "Daft Punk" });
  });
});

describe("fitFontSize", () => {
  it("keeps the size when the line fits", () => {
    expect(fitFontSize(200, 280, 15, 11)).toBe(15);
  });

  it("shrinks a long line just enough to fit, in half pixels", () => {
    expect(fitFontSize(420, 280, 15, 11)).toBe(11);
    expect(fitFontSize(300, 280, 15, 11)).toBe(14);
  });

  it("never goes below the minimum", () => {
    expect(fitFontSize(2000, 280, 15, 11)).toBe(11);
  });
});
