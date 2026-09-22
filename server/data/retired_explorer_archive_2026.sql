--
-- PostgreSQL database dump
--

\restrict OomWkf5TrgEYZKeib8cKLu30WSA2kmAEXjTWLGTrnAPgZOHde4DbhJQUxJnbu1u

-- Dumped from database version 18.3 (Debian 18.3-1.pgdg13+1)
-- Dumped by pg_dump version 18.4 (Debian 18.4-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: explorer_campaign; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.explorer_campaign (id, start_at, end_at, display_name, rules_blurb, created_at, updated_at) FROM stdin;
1	1775016000	1793419199	Outdoor 2026	Inaugural outdoor 2026 Explorer Season	2026-04-19 20:04:32+00	2026-04-19 20:04:32+00
\.


--
-- Data for Name: explorer_destination; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.explorer_destination (id, explorer_campaign_id, strava_segment_id, source_url, cached_name, display_label, display_order, surface_type, category, created_at, updated_at) FROM stdin;
1	1	9858542	https://www.strava.com/segments/9858542	Wachusett Mountain From 140	\N	0	\N	\N	2026-04-19 20:04:32+00	2026-04-19 20:04:32+00
2	1	41233732	https://www.strava.com/segments/41233732	WMV Explorer: Whately Milk Bottle	\N	1	\N	\N	2026-04-19 20:04:32+00	2026-04-19 20:04:32+00
3	1	41233750	https://www.strava.com/segments/41233750	WMV Explorer: Historic Deerfield	\N	2	\N	\N	2026-04-19 20:04:32+00	2026-04-19 20:04:32+00
4	1	41268845	https://www.strava.com/segments/41268845	WMV Explorer: Quabbin Goodnough Dike (CCW)	\N	3	\N	\N	2026-04-19 20:04:32+00	2026-04-19 20:04:32+00
5	1	41268907	https://www.strava.com/segments/41268907	WMV Explorer: Quabbin Tower	\N	4	\N	\N	2026-04-19 20:04:32+00	2026-04-19 20:04:32+00
6	1	41268939	https://www.strava.com/segments/41268939	WMV Explorer: Winsor Dam (Towards Ware Rd)	\N	5	\N	\N	2026-04-19 20:04:32+00	2026-04-19 20:04:32+00
7	1	41269000	https://www.strava.com/segments/41269000	WMV Explorer: Bridge of Names (Adams St to Montague Ave)	\N	6	\N	\N	2026-04-19 20:04:32+00	2026-04-19 20:04:32+00
8	1	11772419	https://www.strava.com/segments/11772419	Gulf Rd Descent	\N	7	\N	\N	2026-04-19 20:04:32+00	2026-04-19 20:04:32+00
9	1	10374283	https://www.strava.com/segments/10374283	Lower to Wisdom	\N	8	\N	\N	2026-04-19 20:04:32+00	2026-04-19 20:04:32+00
10	1	20602810	https://www.strava.com/segments/20602810	Eunice Williams Descent	\N	9	\N	\N	2026-04-19 20:04:32+00	2026-04-19 20:04:32+00
11	1	41269091	https://www.strava.com/segments/41269091	WMV Explorer: Brattleboro to Hinsdale	\N	10	\N	\N	2026-04-19 20:04:32+00	2026-04-19 20:04:32+00
12	1	15557478	https://www.strava.com/segments/15557478	Elm St Overpass West	\N	11	\N	\N	2026-04-19 20:04:32+00	2026-04-19 20:04:32+00
13	1	41269157	https://www.strava.com/segments/41269157	WMV Explorer: Bardwell's Ferry Bridge (Conway to Shelburne)	\N	12	\N	\N	2026-04-19 20:04:32+00	2026-04-19 20:04:32+00
14	1	2480734	https://www.strava.com/segments/2480734	Sugarloaf 1st ramp, kiosk to hairpin	\N	13	\N	\N	2026-04-19 20:04:32+00	2026-04-19 20:04:32+00
16	1	2399394	https://www.strava.com/segments/2399394	Tower Approach South (Greenfield Ridge)	\N	15	\N	\N	2026-04-19 20:04:32+00	2026-04-19 20:04:32+00
19	1	18897171	https://www.strava.com/segments/18897171	Peckville Pain	\N	16	\N	\N	2026-04-26 22:41:17+00	2026-04-26 22:41:17+00
20	1	702233	https://www.strava.com/segments/702233	Baptist Corner Road Descent	\N	17	\N	\N	2026-05-23 00:22:59.314301+00	2026-05-23 00:22:59.314301+00
\.


--
-- Data for Name: explorer_destination_match; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.explorer_destination_match (id, explorer_campaign_id, explorer_destination_id, strava_athlete_id, strava_activity_id, matched_at, created_at, first_completer_athlete_id, first_completer_at) FROM stdin;
3	1	13	614940	18242727495	1777050363	2026-04-24 19:16:40+00	614940	1777050363
4	1	9	295211	18242896473	1777043587	2026-04-24 19:26:10+00	295211	1777043587
8	1	5	6135547	18285106162	1777329279	2026-04-27 23:10:56+00	6135547	1777329279
9	1	6	6135547	18285106162	1777329279	2026-04-27 23:10:56+00	6135547	1777329279
1	1	12	15914403	18365151865	1777833199	2026-05-03 20:58:13.183454+00	15914403	1777833199
2	1	14	88530732	18418546205	1778181991	2026-05-07 22:53:18.216837+00	88530732	1778181991
10	1	2	614940	18602376215	1779394230	2026-05-22 00:16:32.329602+00	614940	1779394230
11	1	12	614940	18602376215	1779394230	2026-05-22 00:16:32.341969+00	\N	\N
12	1	19	295211	18612519041	1779468390	2026-05-22 19:51:18.09888+00	295211	1779468390
13	1	12	16044526	18624458486	1779542127	2026-05-23 17:03:20.38905+00	\N	\N
14	1	20	1912596	18624647327	1779543254	2026-05-23 17:19:48.373902+00	1912596	1779543254
15	1	14	376782	18625097389	1779553969	2026-05-23 18:01:27.490597+00	\N	\N
16	1	20	502935	18624977468	1779541370	2026-05-23 18:17:38.272177+00	\N	\N
17	1	5	136573	18653413542	1779726356	2026-05-25 20:56:28.028264+00	\N	\N
18	1	13	295211	18688256138	1779961288	2026-05-28 12:14:16.522611+00	\N	\N
19	1	13	12269618	18735488757	1780236783	2026-05-31 22:49:49.009494+00	\N	\N
\.


--
-- Data for Name: explorer_destination_pin; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.explorer_destination_pin (id, explorer_campaign_id, explorer_destination_id, strava_athlete_id, created_at) FROM stdin;
1	1	6	366880	2026-04-21 18:02:15+00
\.


--
-- PostgreSQL database dump complete
--

\unrestrict OomWkf5TrgEYZKeib8cKLu30WSA2kmAEXjTWLGTrnAPgZOHde4DbhJQUxJnbu1u

