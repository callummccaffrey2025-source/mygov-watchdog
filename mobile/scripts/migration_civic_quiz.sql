-- Daily Civic Quiz
-- 30 questions covering Australian civic/parliamentary knowledge

CREATE TABLE IF NOT EXISTS civic_quiz (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  options jsonb NOT NULL,
  correct_answer int NOT NULL,
  explanation text NOT NULL,
  source_url text,
  category text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS civic_quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question_id uuid NOT NULL REFERENCES civic_quiz(id) ON DELETE CASCADE,
  answer int NOT NULL,
  is_correct boolean NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_civic_quiz_created ON civic_quiz(created_at);
CREATE INDEX IF NOT EXISTS idx_civic_quiz_answers_question ON civic_quiz_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_civic_quiz_answers_user ON civic_quiz_answers(user_id);

ALTER TABLE civic_quiz ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_quiz_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Anyone reads quiz questions" ON civic_quiz FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Anyone reads answer stats" ON civic_quiz_answers FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Auth users submit answers" ON civic_quiz_answers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- ── Seed 30 questions ───────────────────────────────────────────────────────

INSERT INTO civic_quiz (question, options, correct_answer, explanation, source_url, category) VALUES
('How many senators does each Australian state have?',
 '["6", "10", "12", "14"]'::jsonb, 2,
 'Each of the six states has 12 senators (72 total), plus 2 each from the ACT and NT — 76 senators in total.',
 'https://www.aph.gov.au/Senators_and_Members/Senators', 'Senate'),

('What is a double dissolution?',
 '["An election where both chambers are dissolved", "A bill that fails in both houses", "A change of government", "A parliamentary committee"]'::jsonb, 0,
 'A double dissolution dissolves both the House and Senate for a new election. It can be triggered when the Senate twice rejects a bill from the House.',
 'https://www.aph.gov.au/About_Parliament/Work_of_the_Senate/Double_Dissolution', 'Parliament'),

('How does a bill become law?',
 '["The Prime Minister signs it", "It passes both houses and receives Royal Assent", "The High Court approves it", "A majority of voters approve it"]'::jsonb, 1,
 'A bill must pass both the House of Representatives and the Senate, then receive Royal Assent from the Governor-General to become an Act of Parliament.',
 'https://peo.gov.au/understand-our-parliament/how-parliament-works/bills-and-laws/making-a-law', 'Legislation'),

('What is the role of the Governor-General?',
 '["Head of government", "Leader of the opposition", "Represents the King as head of state", "President of the Senate"]'::jsonb, 2,
 'The Governor-General represents the King as head of state, gives Royal Assent to laws, and has reserve constitutional powers.',
 'https://www.gg.gov.au/about-governor-general/role-governor-general', 'Government'),

('What is Question Time?',
 '["A public Q&A session", "45 minutes each sitting day where opposition questions the government", "An election debate", "A committee hearing"]'::jsonb, 1,
 'Question Time runs for 45 minutes each sitting day in both chambers, allowing MPs (mostly the opposition) to question ministers about government business.',
 'https://peo.gov.au/understand-our-parliament/how-parliament-works/parliamentary-rules/question-time', 'Parliament'),

('How often must federal elections be held?',
 '["Every 2 years", "Within 3 years of the previous election", "Every 4 years", "Every 5 years"]'::jsonb, 1,
 'Federal elections must be held within three years of the previous election. The PM advises the Governor-General on the exact date.',
 'https://www.aec.gov.au/Elections/', 'Elections'),

('What is the difference between the House and Senate?',
 '["The Senate is more powerful", "The House represents electorates, the Senate represents states", "They are the same", "The House is appointed, the Senate elected"]'::jsonb, 1,
 'The House of Representatives has 151 members representing electorates by population. The Senate has 76 senators representing states and territories equally (12 per state).',
 'https://peo.gov.au/understand-our-parliament/how-parliament-works/houses-of-parliament', 'Parliament'),

('How many members are in the House of Representatives?',
 '["76", "120", "151", "226"]'::jsonb, 2,
 'The House of Representatives has 151 members, each representing one of Australia''s 151 electoral divisions.',
 'https://www.aph.gov.au/Senators_and_Members/Members', 'Parliament'),

('What voting system does Australia use for the House of Representatives?',
 '["First-past-the-post", "Preferential voting", "Proportional representation", "Electoral college"]'::jsonb, 1,
 'Australia uses preferential voting (also called instant-runoff) for the House of Representatives. Voters rank candidates from 1 to last.',
 'https://www.aec.gov.au/Voting/How_to_vote/', 'Elections'),

('Is voting compulsory in Australia?',
 '["No, it''s optional", "Yes, for all eligible citizens", "Only in state elections", "Only for over-21s"]'::jsonb, 1,
 'Voting is compulsory for all eligible Australian citizens aged 18 and over. Australia has some of the highest turnout rates in the world at over 96%.',
 'https://www.aec.gov.au/Voting/Compulsory_Voting.htm', 'Elections'),

('Who is the current Prime Minister of Australia?',
 '["Scott Morrison", "Anthony Albanese", "Peter Dutton", "Julia Gillard"]'::jsonb, 1,
 'Anthony Albanese (Labor) has been Prime Minister since May 2022, leading the government after defeating the Coalition at the 2022 federal election.',
 'https://www.pm.gov.au', 'Government'),

('How long is a senator''s term?',
 '["3 years", "4 years", "6 years", "8 years"]'::jsonb, 2,
 'Senators typically serve six-year terms, with half the Senate elected every three years at a regular half-Senate election.',
 'https://www.aph.gov.au/About_Parliament/Senate', 'Senate'),

('What is required to change the Australian Constitution?',
 '["A majority in parliament", "A referendum with double majority", "PM signature", "Royal Assent only"]'::jsonb, 1,
 'Constitutional change requires a referendum with a "double majority" — a national majority of voters AND a majority in four of the six states.',
 'https://peo.gov.au/understand-our-parliament/parliament-and-its-people/a-flag-for-our-nation/referendums-in-australia/', 'Constitution'),

('What is Hansard?',
 '["A parliamentary committee", "The official transcript of parliament", "A political party", "The PM''s residence"]'::jsonb, 1,
 'Hansard is the official, word-for-word transcript of proceedings in both chambers of the Australian Parliament.',
 'https://www.aph.gov.au/Parliamentary_Business/Hansard', 'Parliament'),

('When was Australia federated?',
 '["1 January 1901", "1 July 1900", "26 January 1788", "3 March 1986"]'::jsonb, 0,
 'Australia became a federation on 1 January 1901, when six British colonies united to form the Commonwealth of Australia.',
 'https://www.naa.gov.au/learn-about-records/learning-resources/history-federation', 'History'),

('Who appoints the Governor-General?',
 '["The Prime Minister", "The High Court", "The King, on advice of the PM", "The Senate"]'::jsonb, 2,
 'The King formally appoints the Governor-General on the advice of the Australian Prime Minister. The monarch''s role is ceremonial.',
 'https://www.gg.gov.au/about-governor-general/appointment', 'Government'),

('What is the "balance of power" in the Senate?',
 '["The government''s majority", "Crossbench senators who can decide vote outcomes", "The Speaker''s vote", "The PM''s reserve power"]'::jsonb, 1,
 'When neither major party has a Senate majority, crossbench senators (minor parties and independents) hold the balance of power and can decide which bills pass.',
 'https://www.aph.gov.au/About_Parliament/Senate', 'Senate'),

('What is a private member''s bill?',
 '["A bill kept secret", "A bill introduced by a non-government MP", "A bill about MP salaries", "A bill the PM introduces"]'::jsonb, 1,
 'A private member''s bill is legislation introduced by an MP or senator who is not a minister. They rarely pass but often drive important debates.',
 'https://peo.gov.au/understand-our-parliament/how-parliament-works/bills-and-laws/types-of-bills', 'Legislation'),

('What happens at Budget Night?',
 '["The Treasurer delivers the federal budget", "MPs vote on their salaries", "The election is called", "Parliament closes for the year"]'::jsonb, 0,
 'Budget Night is when the Treasurer presents the federal budget to parliament, usually on the second Tuesday in May. It outlines government spending and revenue.',
 'https://www.aph.gov.au/About_Parliament/Parliamentary_departments/Parliamentary_Library/pubs/rp/budgetreview', 'Budget'),

('What is the role of a parliamentary committee?',
 '["To manage MP travel expenses", "To scrutinise bills and conduct inquiries", "To run elections", "To appoint judges"]'::jsonb, 1,
 'Parliamentary committees scrutinise proposed legislation, conduct inquiries into policy issues, and review government administration.',
 'https://www.aph.gov.au/Parliamentary_Business/Committees', 'Parliament'),

('Who is the Speaker of the House of Representatives?',
 '["The Prime Minister", "The presiding officer elected by MPs", "The longest-serving MP", "Appointed by the Governor-General"]'::jsonb, 1,
 'The Speaker is an MP elected by their fellow MPs to preside over the House of Representatives, maintaining order and interpreting rules.',
 'https://www.aph.gov.au/About_Parliament/House_of_Representatives/Powers_practice_and_procedure/Speaker', 'Parliament'),

('What is a division in parliament?',
 '["A political argument", "A recorded vote where MPs physically move to one side", "A government department", "A parliamentary electorate"]'::jsonb, 1,
 'A division is a formal recorded vote where MPs physically move to either side of the chamber ("ayes" or "noes") so their votes can be counted and recorded.',
 'https://peo.gov.au/understand-our-parliament/how-parliament-works/parliamentary-rules/voting-in-the-house-of-representatives/', 'Parliament'),

('What is the AEC?',
 '["The Australian Education Council", "The Australian Electoral Commission", "The Asian Economic Community", "The Australian Environment Commission"]'::jsonb, 1,
 'The AEC (Australian Electoral Commission) is the independent statutory authority that runs all federal elections and maintains the electoral roll.',
 'https://www.aec.gov.au', 'Elections'),

('What is "crossing the floor"?',
 '["Walking through parliament", "Voting against your own party", "Changing political parties", "Speaking in parliament"]'::jsonb, 1,
 'Crossing the floor means an MP or senator votes against their own party''s position. It''s rare and often seen as a significant act of independence or conscience.',
 'https://peo.gov.au/understand-our-parliament/parliament-and-its-people/people/parties-and-independents/', 'Parliament'),

('What is a referendum?',
 '["A parliamentary vote", "A national vote on changing the Constitution", "A committee inquiry", "An election debate"]'::jsonb, 1,
 'A referendum is a national vote required to change the Constitution. It needs a double majority — a national majority plus a majority in 4 of 6 states.',
 'https://www.aec.gov.au/Elections/referendums/', 'Constitution'),

('Which chamber introduces most appropriation (money) bills?',
 '["The Senate", "The House of Representatives", "Either chamber", "The High Court"]'::jsonb, 1,
 'Appropriation bills (money bills) must be introduced in the House of Representatives. The Senate cannot amend them but can reject them.',
 'https://www.aph.gov.au/About_Parliament/House_of_Representatives', 'Parliament'),

('What is the Opposition''s role in parliament?',
 '["To govern the country", "To scrutinise and challenge the government", "To run elections", "To sign laws"]'::jsonb, 1,
 'The Opposition, led by the Leader of the Opposition, scrutinises and challenges government policy, proposes alternatives, and prepares to govern if elected.',
 'https://peo.gov.au/understand-our-parliament/parliament-and-its-people/parliament-at-work/opposition/', 'Parliament'),

('What is a "supply" bill?',
 '["A bill about trade", "A bill authorising government spending", "A bill about food supply", "A bill about the military"]'::jsonb, 1,
 'Supply bills authorise the government to spend money from the Treasury. Blocking supply in the Senate caused the 1975 constitutional crisis.',
 'https://www.aph.gov.au/About_Parliament/Parliamentary_departments/Parliamentary_Library/pubs/BriefingBook47p/SupplyBills', 'Legislation'),

('Who was Australia''s first Prime Minister?',
 '["Robert Menzies", "Edmund Barton", "Alfred Deakin", "Andrew Fisher"]'::jsonb, 1,
 'Edmund Barton was Australia''s first Prime Minister, serving from 1901 to 1903 after federation. He later became a founding justice of the High Court.',
 'https://www.naa.gov.au/explore-collection/australias-prime-ministers/edmund-barton', 'History'),

('What does "prorogue" mean in a parliamentary context?',
 '["To start parliament", "To suspend parliament without dissolving it", "To call an election", "To pass a bill"]'::jsonb, 1,
 'To prorogue parliament means to suspend it without dissolving it. Parliament technically continues but doesn''t sit until recalled by proclamation.',
 'https://www.aph.gov.au/About_Parliament/Senate/Powers_practice_n_procedures/Procedural_Information_Notes/No.3', 'Parliament')
ON CONFLICT DO NOTHING;
