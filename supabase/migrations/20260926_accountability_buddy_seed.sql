-- Accountability Buddy — seed data (spec §8 and §6a).
-- Applies after 20260926_accountability_buddy.sql. Single transaction; the
-- student id is looked up by email, so nothing depends on a generated uuid.

DO $$
DECLARE v_john uuid;
BEGIN
  INSERT INTO public.buddy_students (name, email, project_name, zoom_url, next_meeting_at)
  VALUES ('John Eusebio', 'john.eusebio@mail.utoronto.ca', 'PhD thesis',
          'https://utoronto.zoom.us/my/normanfarb',
          '2026-10-02 15:00:00'::timestamp AT TIME ZONE 'America/Toronto')
  RETURNING id INTO v_john;

  INSERT INTO public.buddy_milestones (student_id, position, title, target_date) VALUES
    (v_john,  1, 'Assemble reading list',                                   '2026-10-09'),
    (v_john,  2, 'Email reading list to committee',                         '2026-10-16'),
    (v_john,  3, 'Update reading list based on committee recommendations',  '2026-11-06'),
    (v_john,  4, 'Schedule reading list defense',                           '2026-11-13'),
    (v_john,  5, 'Hold reading list defense',                               '2026-12-11'),
    (v_john,  6, 'Complete write-up of Study 2',                            '2026-12-11'),
    (v_john,  7, 'Complete write-up of Study 3',                            '2027-01-22'),
    (v_john,  8, 'Complete draft of general introduction',                  '2027-02-12'),
    (v_john,  9, 'Complete draft of general discussion',                    '2027-03-05'),
    (v_john, 10, 'Assemble complete thesis draft',                          '2027-03-12'),
    (v_john, 11, 'Review thesis draft with supervisor',                     '2027-04-02'),
    (v_john, 12, 'Send complete thesis draft to committee',                 '2027-04-09'),
    (v_john, 13, 'Receive committee approval or revisions',                 '2027-05-07'),
    (v_john, 14, 'Complete revisions',                                      '2027-05-21'),
    (v_john, 15, 'Written thesis approved by committee',                    '2027-05-28'),
    (v_john, 16, 'Schedule PhD thesis defense (SGS approval)',              '2027-06-11'),
    (v_john, 17, 'Final oral examination',                                  '2027-08-13');

  -- No outcome: Monday's email therefore asks about it first.
  INSERT INTO public.buddy_goals (student_id, set_on, goal_text)
  VALUES (v_john, '2026-09-25', 'Start using Accountability Buddy');
END;
$$;

INSERT INTO public.buddy_tag_options (tag, position) VALUES
  ('reading', 1), ('writing', 2), ('analysis', 3), ('email/admin', 4), ('scheduling', 5), ('other', 6);

-- From accountability_buddy_quotes.md (81 entries, verbatim; position = list
-- number). Quote marks are part of the stored text so the originals without
-- them render correctly. Still a draft for Norm's veto — deactivate, don't delete,
-- once a quote has been sent (buddy_sends.quote_id).
INSERT INTO public.buddy_quotes (position, quote, source, tag) VALUES
  (1, '"Never tell me the odds."', 'Han Solo, The Empire Strikes Back', 'The committee will tell you anyway.'),
  (2, '"Do. Or do not. There is no try."', 'Yoda, The Empire Strikes Back', 'Conveniently, also the check-in format.'),
  (3, '"Stay on target."', 'Gold Five, A New Hope', 'Especially you, inbox.'),
  (4, '"I have a bad feeling about this."', 'Every Star Wars film', 'Normal for chapter openings. Push through.'),
  (5, '"Make it so."', 'Captain Picard', 'The reading list will not make itself so.'),
  (6, '"I''m a doctor, not a..."', 'Dr. McCoy', 'Not yet. Working on it.'),
  (7, '"Resistance is futile."', 'The Borg', 'Resistance to writing, specifically.'),
  (8, '"Engage."', 'Captain Picard', 'With the Methods section.'),
  (9, '"Live long and prosper."', 'Spock', 'Write short and prosper.'),
  (10, '"It''s dangerous to go alone! Take this."', 'The Legend of Zelda', 'Hands you a supervisor.'),
  (11, '"Hey! Listen!"', 'Navi, Ocarina of Time', 'This is your daily Navi. Sorry.'),
  (12, '"Thank you Mario! But our princess is in another castle!"', 'Super Mario Bros.', 'Your thesis is in another chapter.'),
  (13, '"Let''s-a go!"', 'Mario', 'One small goal. Let''s-a go.'),
  (14, '"It''s super effective!"', 'Pokémon', 'Said no one about doomscrolling.'),
  (15, '"A wild THESIS appeared!"', 'after Pokémon', 'THESIS used Guilt. It''s not very effective. Try a 25-minute timer.'),
  (16, '"Do a barrel roll!"', 'Peppy, Star Fox 64', 'Or just open the document. Either works.'),
  (17, '"Hey, you. You''re finally awake."', 'Skyrim', 'It''s 8am. One goal, then coffee.'),
  (18, '"I used to be an adventurer like you. Then I took an arrow in the knee."', 'Skyrim', 'No arrows today. Just one goal.'),
  (19, '"Rise and shine, Mr. Freeman."', 'G-Man, Half-Life 2', 'Rise and shine, future Doctor.'),
  (20, '"The right man in the wrong place can make all the difference in the world."', 'G-Man, Half-Life 2', 'So can the right paragraph in the right place.'),
  (21, '"The cake is a lie."', 'Portal', 'The defense party, however, is real.'),
  (22, '"Would you kindly..."', 'BioShock', '...write one paragraph?'),
  (23, '"Stay a while and listen."', 'Deckard Cain, Diablo', 'Then stop listening and start writing.'),
  (24, '"Praise the sun!"', 'Solaire, Dark Souls', 'Git gud at citations.'),
  (25, '"You must construct additional pylons."', 'StarCraft', 'Citations. You must construct additional citations.'),
  (26, '"All your base are belong to us."', 'Zero Wing', 'All your data are belong to Study 2.'),
  (27, '"A winner is you."', 'Pro Wrestling, NES', 'Grammatically questionable. Emotionally accurate.'),
  (28, '"Wake up, Samurai. We have a city to burn."', 'Cyberpunk 2077', 'We have a reading list to finish. Less dramatic.'),
  (29, '"Objection!"', 'Phoenix Wright, Ace Attorney', 'Practice for the defense.'),
  (30, '"It''s over 9000!"', 'Vegeta, Dragon Ball Z', 'Your eventual word count.'),
  (31, '"Plus Ultra!"', 'My Hero Academia', 'Go beyond. Or at least go to page 2.'),
  (32, '"Believe it!"', 'Naruto, English dub', 'Believe it. Then write it.'),
  (33, '"I''m gonna be King of the Pirates!"', 'Luffy, One Piece', 'You''re gonna be Doctor of Philosophy. Fewer sea monsters.'),
  (34, '"Just as planned."', 'Light Yagami, Death Note', 'Today''s goal, ideally.'),
  (35, '"I''ll take a potato chip... and eat it!"', 'Light Yagami, Death Note', 'Bring this energy to one small task.'),
  (36, '"Believe in the me that believes in you!"', 'Kamina, Gurren Lagann', 'Your supervisor, basically.'),
  (37, '"Who the hell do you think I am?!"', 'Kamina, Gurren Lagann', 'A PhD candidate. Drill through it.'),
  (38, '"El Psy Kongroo."', 'Okabe, Steins;Gate', 'This is the choice of Steins;Gate. And your committee.'),
  (39, '"Yare yare daze."', 'Jotaro, JoJo''s Bizarre Adventure', 'Yare yare. Open the doc anyway.'),
  (40, '"Tatakae."', 'Eren, Attack on Titan', 'Fight. The introduction section, specifically.'),
  (41, '"Waku waku!"', 'Anya, Spy x Family', 'Excitement about Methods is allowed.'),
  (42, '"ORA ORA ORA ORA!"', 'Star Platinum, JoJo''s Bizarre Adventure', 'This is your keyboard today.'),
  (43, '"MUDA MUDA MUDA!"', 'Dio', 'That''s your inner critic. Ignore it.'),
  (44, '"Oh? You''re approaching me?"', 'Dio', 'Approach the thesis anyway.'),
  (45, '"ZA WARUDO! Toki wo tomare!"', 'Dio', 'Sadly, the deadline does not stop.'),
  (46, '"It was me, Dio!"', 'Dio', 'You thought it was a quote of the day, but it was me, your supervisor!'),
  (47, '"Your next line is..."', 'Joseph Joestar', '"I''ll open the document now."'),
  (48, '"Nigerundayo, Smokey!"', 'Joseph Joestar', 'Joseph''s strategy. Not recommended for chapters.'),
  (49, '"I, Giorno Giovanna, have a dream."', 'Golden Wind', 'You have a thesis. Close enough.'),
  (50, '"Arrivederci."', 'Bruno Bucciarati', 'To your distractions.'),
  (51, 'ゴゴゴゴ', 'Menacing sound effect', 'The FOE approaches.'),
  (52, 'To Be Continued ⟶', 'Every JoJo episode ending', 'Tomorrow, 8am.'),
  (53, '"I''m Mr. Meeseeks, look at me!"', 'Rick and Morty', 'Meeseeks complete one task and vanish. Be a Meeseeks about today''s goal.'),
  (54, '"What is my purpose?" "You pass butter."', 'Butter Robot, Rick and Morty', 'Your purpose today: bigger than butter, smaller than a thesis.'),
  (55, '"I turned myself into a pickle, Morty!"', 'Rick', 'Resourcefulness under constraints. Apply to paragraph 1.'),
  (56, '"Sometimes science is more art than science, Morty."', 'Rick', 'Especially the discussion section.'),
  (57, '"Show me what you got!"', 'Giant heads, Rick and Morty', 'The committee, basically.'),
  (58, '"Get schwifty."', 'Rick and Morty', 'Then get writing.'),
  (59, '"Ooo-wee!"', 'Mr. Poopybutthole', 'The appropriate response to a Yes.'),
  (60, '"Peace among worlds."', 'Rick', 'And among co-authors.'),
  (61, 'Rick has a portal gun. You have a word processor. Similar power level, fewer interdimensional consequences.', 'Original', NULL),
  (62, 'Just a quick 20-minute adventure, Morty. In and out.', 'after Rick', 'Today''s writing session, ideally.'),
  (63, '"Have you tried turning it off and on again?"', 'Roy, The IT Crowd', 'Works for brains too. Short walk, then one goal.'),
  (64, '"Good news, everyone!"', 'Professor Farnsworth, Futurama', 'It''s a weekday.'),
  (65, '"There is no spoon."', 'The Matrix', 'There is no perfect first draft either.'),
  (66, '"With great power comes great responsibility."', 'Spider-Man', 'With great datasets come great write-ups.'),
  (67, '"I can do this all day."', 'Captain America', 'You don''t have to. Just one goal.'),
  (68, '"Allons-y!"', 'The Tenth Doctor, Doctor Who', 'Different kind of Doctor, same enthusiasm.'),
  (69, '"Dude, sucking at something is the first step to being sorta good at something."', 'Jake, Adventure Time', 'Applies to first drafts.'),
  (70, 'Your Stand: 「THESIS DEFENSE」. Power: A. Speed: E. Development potential: A.', 'JoJo, sort of', NULL),
  (71, '"It''s not like I wrote this paragraph for you or anything, b-baka!"', 'Every tsundere', 'Write it anyway.'),
  (72, 'Isekai''d into a world where theses write themselves? Still loading.', 'Isekai protagonist, probably', NULL),
  (73, 'Training arc: in progress. Montage music not included.', 'Every shonen', NULL),
  (74, 'Side quest detected: email. Main quest: thesis.', 'Every RPG', NULL),
  (75, 'Achievement unlocked: opened the document. Next achievement: 200 words.', NULL, NULL),
  (76, 'Save point reached. Back up your files.', 'Every RPG', NULL),
  (77, 'Loading screen tip: the introduction is easier to write last.', NULL, NULL),
  (78, 'Loading screen tip: reviewers cannot hurt you in the overworld.', NULL, NULL),
  (79, 'Final boss: the FOE. Level up accordingly.', NULL, NULL),
  (80, 'Filler episode? Not today.', NULL, NULL),
  (81, 'The power of friendship will not write your discussion section. Your committee might help, though.', 'Every anime', NULL);
