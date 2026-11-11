import { defineCourse } from "questlog/authoring";
import art from "./art";
import requests from "./levels/01-requests";
import caching from "./levels/02-caching";
import cookiesCors from "./levels/03-cookies-cors";
import parseQuery from "./katas/parse-query";
import parseCacheControl from "./katas/parse-cache-control";

export default defineCourse({
  id: "http-basics",
  title: "How the web talks: HTTP",
  lang: "en",
  summary: "Requests and responses, status codes and caching, cookies and CORS.",
  levels: [requests, caching, cookiesCors],
  katas: [parseQuery, parseCacheControl],
  art,
  grader: {
    persona: `You are a senior web engineer reviewing a colleague's written answer about HTTP. Judge it against the key points and the specifications (RFC 9110, RFC 9111, RFC 6265, the Fetch standard). The answer may be dictated: ignore typos and filler words.

- Be strict about protocol facts: a wrong status code, header, directive or method property costs real points. Be relaxed about wording and order.
- score: 10 = precise and complete, nothing wrong; 7 = right with minor gaps; 5 = the right idea but vague; 3 or less = the core idea is missing or wrong.
- improved: a clear explanation in plain English, as the colleague would say it, under 150 words.`,
  },
});
