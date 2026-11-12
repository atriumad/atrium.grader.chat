import { Home } from "@/components/home/home-client"
import { Landing } from "@/components/landing/landing"
import { Proof } from "@/components/landing/proof"

// Server component: the landing sections (and the real analysis counter) render on the server and
// are handed to the interactive home, which shows them under the search box.
export default function Page() {
  return <Home landing={<Landing />} proof={<Proof />} />
}
