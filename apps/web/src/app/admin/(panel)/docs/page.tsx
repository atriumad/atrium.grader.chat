import Link from "next/link"

import { PageHeader } from "@/components/admin/ui"
import { Bullets, Code, DocSection, Flow, H3, Note, P, Table } from "@/components/admin/docs"

const TOC = [
  { id: "overview", label: "What Atrium Grader is" },
  { id: "journey", label: "The visitor's journey" },
  { id: "analysis", label: "How an analysis works" },
  { id: "score", label: "The Atrium Score" },
  { id: "chat", label: "The chat assistant" },
  { id: "booking", label: "Booking meetings" },
  { id: "agent", label: "The research agent" },
  { id: "panel", label: "Using this panel" },
  { id: "limits", label: "Limits and protection" },
  { id: "costs", label: "Where the money goes" },
  { id: "troubleshooting", label: "When something looks wrong" },
]

export default function DocsPage() {
  return (
    <>
      <PageHeader title="How Atrium works">
        A plain-language guide to the flows and features behind the Grader: what a visitor sees, what happens behind the scenes, and what you can change from this panel.
      </PageHeader>

      <div className="flex gap-10">
        <article className="flex min-w-0 flex-1 flex-col gap-10">
          <DocSection
            id="overview"
            title="What Atrium Grader is"
            lead="A free tool on the agency's website. A restaurant owner types their business, and in about 40 seconds gets a diagnosis of their online presence compared with nearby competitors."
          >
            <P>
              The goal is twofold: give the owner something genuinely useful, and give the agency a warm lead. Every analysis ends with a conversation where the assistant explains the results and offers a meeting with the team.
            </P>
            <Table
              head={["Piece", "What it does", "Where it lives"]}
              rows={[
                ["Grader (web)", "The public site: search, scan screen, report, chat.", "apps/web"],
                ["Admin panel", "This area. Rules, assistant settings, knowledge, usage and costs.", "apps/web, /admin"],
                ["Research agent", "Optional separate service that gathers the data for an analysis.", "apps/agent, agents.atriumad.com"],
                ["Database", "Stores analyses, events, lookups, published rules and knowledge.", "Supabase"],
                ["Providers", "Google Places for listings; Apify and ScrapeCreators for social networks; Claude for writing and chat.", "External"],
              ]}
            />
          </DocSection>

          <DocSection id="journey" title="The visitor's journey" lead="Five moments, from first keystroke to a booked meeting.">
            <Flow
              steps={[
                {
                  title: "Search",
                  text: "The visitor starts typing a business name. Google suggestions appear (name only, US). They can also paste an Instagram @handle instead.",
                },
                {
                  title: "Scan",
                  text: "A live screen shows real steps as they happen: Google listing, nearby competitors, social networks, writing. Each step shows a real value it found, never a guess.",
                },
                {
                  title: "Report",
                  text: "A single-screen dashboard: the Atrium Score, the competitor map and ranking, per-channel tabs, and a view of data gaps. The written analysis streams in first; the map and ranking appear after it finishes.",
                },
                {
                  title: "Chat",
                  text: "The assistant answers questions about the results. It can check live numbers, audit the website, check Google ranking, and cite the agency's own material.",
                },
                {
                  title: "Meeting",
                  text: "If the visitor wants help, the assistant shows real free slots, collects name and email, and the visitor confirms with a button.",
                },
              ]}
            />
            <Note title="Two depths">
              Anonymous visitors get the <strong>basic</strong> analysis, which reads only Instagram (cheap). Anything else runs the <strong>full</strong> analysis with every network.
            </Note>
          </DocSection>

          <DocSection
            id="analysis"
            title="How an analysis works"
            lead="One request to /api/analyze streams progress as it goes. The order below is what the scan screen shows."
          >
            <Flow
              steps={[
                {
                  title: "Checks before spending money",
                  text: "A per-visitor limit and a daily cap on total analyses protect the paid providers. Over the limit, the visitor gets a clear message instead of a scan.",
                },
                {
                  title: "Load the current rules",
                  text: "The score rules, the assistant settings and the pinned knowledge published in this panel are loaded. If the database is down, built-in defaults are used.",
                },
                {
                  title: "Identify the business",
                  text: "From a name: Google Places finds candidates. If it is ambiguous, a typo, or needs confirmation, the visitor is asked to pick. From an Instagram handle: the profile is read first, then a Google listing is attached only if it is verifiably the same business (same website or a close name match).",
                },
                {
                  title: "Find the other networks",
                  text: "The business website is read for links to Instagram, Facebook, TikTok and YouTube. If the site blocks bots or has no links, a name-validated Google search is the fallback.",
                },
                {
                  title: "Find competitors",
                  text: "Nearby businesses of the same type within 1.9 miles. Up to 3 distinct competitors get their social networks read (Instagram only, to control cost). Several locations of one brand count once, and locations of the visitor's own brand are excluded.",
                },
                {
                  title: "Score and write",
                  text: "Everyone is scored with the same rules. Claude then writes the analysis from the data, following the tone and extra instructions set under Agents.",
                },
                {
                  title: "Save",
                  text: "The full dataset, score, duration and data source are stored so you can review it under Analyses.",
                },
              ]}
            />
            <H3>What "data gaps" mean</H3>
            <P>
              When a network cannot be read (private account, blocked site, provider out of credits), the report says exactly that instead of pretending the business has no account. A provider failure is never reported as "no presence".
            </P>
          </DocSection>

          <DocSection
            id="score"
            title="The Atrium Score"
            lead="A 0-100 number built from five parts. Social signals weigh 73% because social media is the agency's focus; Google reputation is 27%."
          >
            <Table
              head={["Part", "Default weight", "What it measures"]}
              rows={[
                ["Engagement", "28", "Interactions relative to what is normal for an account of that size. Big accounts are expected to get less, and each network has its own typical level."],
                ["Reputation", "27", "Google rating and review volume. Uses a Bayesian average so a 5.0 from three reviews does not beat a 4.7 from two thousand."],
                ["Activity", "22", "Posting frequency (60%) and how recent the last post is (40%)."],
                ["Audience", "13", "Follower count on a log scale between a floor and a full-score level."],
                ["Presence", "10", "How many networks had a post in the last 30 days."],
              ]}
            />
            <H3>Levels and confidence</H3>
            <Bullets
              items={[
                <>
                  <strong>Good</strong> from 70, <strong>Medium</strong> from 45, <strong>Low</strong> below. <strong>No data</strong> when there is nothing to score.
                </>,
                <>Each score carries a <strong>confidence</strong> level. With too few posts analyzed, or missing data, confidence drops and the report says so.</>,
                <>The halo on each map pin takes its color from the level; its size from the social audience.</>,
              ]}
            />
            <Note title="Changing the rules is safe">
              In <Link href="/admin/scoring" className="underline underline-offset-2">Score</Link> you edit weights and thresholds, preview how real past analyses would change, then publish. New analyses use the new rules; existing ones keep theirs. Every published version is kept in the history.
            </Note>
          </DocSection>

          <DocSection
            id="chat"
            title="The chat assistant"
            lead="After the report, the visitor can talk to an assistant that already knows the whole dataset."
          >
            <P>
              It receives the scores, parts, missing data and written analysis as context, plus the tone and instructions you set. It can also use tools. Each tool can be switched on or off under <Link href="/admin/agentes" className="underline underline-offset-2">Agents</Link>.
            </P>
            <Table
              head={["Tool", "What it does", "Cost"]}
              rows={[
                ["Live social stats", "Re-reads a network's numbers and compares them with the report.", "One external lookup"],
                ["Live Google Maps", "Re-reads rating, reviews and website of the business or a competitor.", "One Google call"],
                ["Website SEO", "Checks the homepage: title, description, H1, structured data, mobile, sitemap, robots, speed.", "Free"],
                ["Google ranking", "Where the site appears for a customer search, and who shows up instead.", "One external lookup"],
                ["Knowledge base", "Searches the material the agency uploaded.", "Free"],
                ["Availability and meeting", "Shows real free slots and prepares a meeting card.", "Calendar read"],
              ]}
            />
            <Bullets
              items={[
                <>The assistant must not invent. If the knowledge base returns nothing, it says it does not have that information.</>,
                <>The number of tool rounds per answer is capped (default 8, range 2-12).</>,
                <>Proposing a meeting never books anything. Only the visitor's button press does.</>,
              ]}
            />
          </DocSection>

          <DocSection id="booking" title="Booking meetings" lead="Real availability, one confirmation, no double bookings.">
            <Flow
              steps={[
                { title: "Ask for availability", text: "The assistant calls the calendar and receives free slots, spread across days and filtered by morning or afternoon if the visitor prefers." },
                { title: "Pick a slot", text: "Slots appear as buttons. The assistant never invents times." },
                { title: "Collect details", text: "Name and email are required; phone and a one-line note are optional. The assistant shows a card to review." },
                { title: "Confirm", text: "The visitor presses the confirm button. The server re-checks that the slot is still free, validates every field, then creates the event. Bookings are processed one at a time so two people cannot take the same slot." },
              ]}
            />
            <H3>Default schedule</H3>
            <Bullets
              items={[
                <>30-minute meetings, Monday to Friday, 09:00-17:00 America/New_York.</>,
                <>At least 12 hours of notice; slots up to 14 days ahead.</>,
                <>All of this is set with environment variables (<Code>BOOKING_HOURS</Code>, <Code>BOOKING_DAYS</Code>, <Code>BOOKING_TIMEZONE</Code>, <Code>BOOKING_DURATION_MIN</Code>, <Code>BOOKING_MIN_NOTICE_HOURS</Code>, <Code>BOOKING_HORIZON_DAYS</Code>).</>,
              ]}
            />
            <Table
              head={["BOOKING_PROVIDER", "Behavior"]}
              rows={[
                [<Code key="n">none</Code>, "Default. The assistant tells the visitor the agenda is unavailable."],
                [<Code key="m">mock</Code>, "Local testing only. Looks like it works but books nothing real."],
                [<Code key="g">google</Code>, "Real Google Calendar. Needs OAuth credentials and a refresh token in the environment."],
              ]}
            />
            <Note kind="warn" title="Production needs google">
              If production still has <Code>mock</Code> or <Code>none</Code>, visitors cannot book real meetings. Check this after any environment change.
            </Note>
          </DocSection>

          <DocSection
            id="agent"
            title="The research agent"
            lead="A separate service that gathers facts about a business. It only collects data and evidence; the Grader scores and writes."
          >
            <P>
              The Grader can do its own lookups, or delegate to the agent. Delegation is on only when <Code>ANALYZE_VIA_AGENT=1</Code> and both <Code>AGENT_URL</Code> and <Code>AGENT_API_KEY</Code> are set. If the service is off, unreachable, or cannot decide which business it is, the Grader silently falls back to its own flow.
            </P>
            <Bullets
              items={[
                <><strong>Access by profile.</strong> The Grader uses the public profile (Google, websites, public social data). A public caller can never reach private tools.</>,
                <><strong>Authentication.</strong> Each caller has an API key; only its hash is stored on the server.</>,
                <><strong>Budgets.</strong> Every request has limits on tool calls, time and cost, plus caching and timeouts.</>,
                <><strong>Honest results.</strong> The answer streams back as data, gaps, evidence and confidence.</>,
              ]}
            />
            <P>
              In the analyses list, the <em>source</em> column tells you whether an analysis went through the agent or the Grader's own flow.
            </P>
          </DocSection>

          <DocSection id="panel" title="Using this panel" lead="What each section is for and when you would open it.">
            <Table
              head={["Section", "Use it to"]}
              rows={[
                [<Link key="o" href="/admin" className="underline underline-offset-2">Overview</Link>, "See activity at a glance: analyses, chats, bookings, errors, which tools get used, credits left."],
                [<Link key="a" href="/admin/analisis" className="underline underline-offset-2">Analyses</Link>, "Open any past analysis: the data, the written text, the score and where the data came from."],
                [<Link key="s" href="/admin/scoring" className="underline underline-offset-2">Score</Link>, "Edit, preview and publish scoring rules. Roll back from the history."],
                [<Link key="g" href="/admin/agentes" className="underline underline-offset-2">Agents</Link>, "Set tone (friendly, formal, direct), add extra instructions for chat and analysis, cap tool rounds, turn tools on or off."],
                [<Link key="k" href="/admin/conocimiento" className="underline underline-offset-2">Knowledge</Link>, "Upload services, case studies, prices and policies the assistant can use. Pin entries so they are always included."],
                [<Link key="c" href="/admin/costos" className="underline underline-offset-2">Costs</Link>, "Watch provider spend against the monthly cap."],
                [<Link key="b" href="/admin/busquedas" className="underline underline-offset-2">Lookups</Link>, "Inspect every external lookup, grouped by client, with each provider's response."],
              ]}
            />
            <H3>Knowledge base basics</H3>
            <Bullets
              items={[
                <>Accepts text and PDF files up to 5 MB.</>,
                <>Content is cut into chunks of about 1,000 characters so the assistant retrieves only the relevant excerpts.</>,
                <><strong>Pinned</strong> entries are always sent to the assistant; the rest are searched on demand. Pin sparingly: pinned text is paid for on every chat.</>,
              ]}
            />
            <H3>Who can enter</H3>
            <P>
              Only emails on the administrators allowlist. A signed-in user who is not on it sees a "No access" screen. Sign out from the bottom of the side menu.
            </P>
          </DocSection>

          <DocSection id="limits" title="Limits and protection" lead="Every analysis and chat spends paid credits, so abuse is capped in several layers.">
            <Table
              head={["What", "Limit"]}
              rows={[
                ["Analyses per visitor", "6 every 10 minutes"],
                ["Analyses per day, all visitors", "400 by default (ANALYZE_DAILY_CAP)"],
                ["Chat messages per visitor", "40 every 10 minutes"],
                ["Place suggestions per visitor", "60 per minute"],
                ["Booking attempts per visitor", "10 every 10 minutes"],
                ["Bookings per email", "2 per day"],
                ["Bookings overall", "40 per hour"],
              ]}
            />
            <Note title="Good to know">
              The per-visitor counters live in server memory, so they reset when the server restarts or redeploys. The daily cap is counted from the database and survives restarts. The database itself rejects public access: only the server, with its service key, can read or write.
            </Note>
          </DocSection>

          <DocSection id="costs" title="Where the money goes" lead="Three kinds of spend. Only one of them is measured exactly.">
            <Bullets
              items={[
                <><strong>Apify</strong> (social scraping): measured. The Costs page reads real usage and the monthly cap from Apify. Facebook is the most expensive network, which is one reason competitors are read on Instagram only.</>,
                <><strong>Google Places</strong>: estimated from counted calls, because Google does not expose billing through the API. Suggestion lookups are logged as events so they can be counted.</>,
                <><strong>Claude</strong> (analysis text and chat): billed by tokens on the Anthropic account. Long pinned knowledge and long chats raise it.</>,
              ]}
            />
            <P>If a provider runs out of credits, analyses do not crash: the affected network shows as a data gap with the reason "no credits".</P>
          </DocSection>

          <DocSection id="troubleshooting" title="When something looks wrong" lead="Symptoms you may see, and where to look first.">
            <Table
              head={["Symptom", "Likely cause", "Check"]}
              rows={[
                ["A network shows as missing for a business that clearly has it", "Site blocks bots, link is on a subpage, or provider out of credits", "Lookups: open that client's group and read each provider's response"],
                ["Wrong location picked for a chain", "Several locations; the most-reviewed one is chosen by default", "Analyses: check the address on the listing; ask the visitor to pick from the choices"],
                ["Visitors say they cannot book", "BOOKING_PROVIDER is none or mock in production", "Environment variables; test a full booking"],
                ["Analyses fail with a capacity message", "The daily cap was reached", "Overview; raise ANALYZE_DAILY_CAP if intended"],
                ["Score looks off after an edit", "A newly published rule set", "Score history: compare and roll back"],
                ["Analyses stop using the agent", "Agent unreachable, so the Grader fell back", "Source column in Analyses; agent health at /healthz"],
                ["Costs page shows no Apify data", "APIFY_TOKEN not set", "Environment variables"],
              ]}
            />
          </DocSection>
        </article>

        <nav aria-label="On this page" className="sticky top-6 hidden h-fit w-44 shrink-0 xl:block">
          <p className="mb-2 text-xs font-medium text-muted-foreground">On this page</p>
          <ul className="flex flex-col gap-0.5 border-l">
            {TOC.map((t) => (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  className="-ml-px block border-l border-transparent py-1 pl-3 text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                >
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  )
}
