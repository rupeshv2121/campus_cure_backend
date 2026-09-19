/**
 * Demo data seeder.
 *
 * The AI features are real but demo badly on the current database: 7 doubts
 * mostly titled "New Title 2", 5 approved answers, and no genuine duplicate
 * complaints. CC-12 has almost nothing to ground on, CC-11 has nothing to
 * retrieve, and CC-13 found zero clusters because none exist.
 *
 * This creates a realistic corpus. It is deliberately structured so the
 * features have something to find:
 *
 *   - paraphrase pairs among the doubts, so semantic search beats keyword
 *   - answered doubts across every subject, so CC-12 has grounding
 *   - duplicate complaint clusters in shared rooms, so CC-13 has clusters
 *
 * SAFETY
 *   - Everything is tagged: userID starts with SEED_, emails end in
 *     @seed.campuscure.local. `npx tsx src/scripts/removeDemoData.ts` removes
 *     exactly those records and nothing else.
 *   - Idempotent: re-running skips users that already exist.
 *   - Only ever inserts. No existing row is modified or deleted.
 *
 * Run:
 *   npx tsx src/scripts/seedDemoData.ts --dry-run   (report, write nothing)
 *   npx tsx src/scripts/seedDemoData.ts
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import { ApprovalStatus, DoubtStatus, Role } from "@prisma/client";
import { prisma } from "../config/database.js";
import { enqueueEmbedding } from "../repositories/embeddingRepository.js";

// Shared with removeDemoData via a constants-only module, so that importing
// one script never executes the other.
import { SEED_EMAIL_DOMAIN, SEED_PREFIX } from "./seedConstants.js";

/**
 * Shared password for every seeded account.
 *
 * These are real, loginable accounts in a real database. That is the point —
 * you can demo as a student — but it is also why removeDemoData exists and
 * should be run once the demo is over.
 */
const SEED_PASSWORD = "CampusDemo#2026";

const DEPARTMENTS = [
  { department: "Computer Engineering", branch: "CE" },
  { department: "Information Technology", branch: "IT" },
  { department: "Electronics Engineering", branch: "EXTC" },
];

const SUBJECTS = ["DSA", "DBMS", "OS", "NETWORKS", "COA"] as const;

const FIRST_NAMES = [
  "Aarav", "Ananya", "Rohan", "Priya", "Arjun", "Sneha", "Vikram", "Meera",
  "Karan", "Divya", "Rahul", "Ishita", "Aditya", "Nikita", "Siddharth",
  "Pooja", "Manav", "Shreya", "Varun", "Tanvi", "Nikhil", "Riya", "Kabir",
  "Anjali", "Yash", "Sanya", "Dev", "Kavya", "Harsh", "Neha", "Omkar",
  "Sakshi", "Rupesh", "Aisha", "Tejas", "Gauri", "Pranav", "Mitali",
];

const LAST_NAMES = [
  "Sharma", "Patel", "Verma", "Nair", "Iyer", "Desai", "Joshi", "Mehta",
  "Reddy", "Kulkarni", "Chauhan", "Bose", "Rao", "Gupta", "Shetty", "Pillai",
];

/**
 * Doubts, with answers where they have one.
 *
 * Several are deliberate paraphrases of one another ("Explain binary search"
 * vs "How does binary search work?") so CC-11 can demonstrate something the
 * keyword baseline structurally cannot do.
 */
interface SeedDoubt {
  subject: (typeof SUBJECTS)[number];
  semester: number;
  title: string;
  description: string;
  answer?: string;
  verified?: boolean;
}

const DOUBTS: SeedDoubt[] = [
  // --- DSA ---
  { subject: "DSA", semester: 3, title: "Explain binary search", description: "I do not follow how binary search narrows the range at each step. Could someone walk through it with an example array?", answer: "Binary search works on a sorted array. Keep two pointers, low and high. Look at the middle element: if it equals the target you are done; if the target is smaller, everything from the middle rightwards can be discarded, so set high = mid - 1; if larger, set low = mid + 1. Each comparison halves the remaining range, which is why it runs in O(log n). The common mistake is computing mid as (low + high) / 2, which can overflow — use low + (high - low) / 2.", verified: true },
  { subject: "DSA", semester: 3, title: "How does binary search work?", description: "Struggling to understand why we discard half the array every time." },
  { subject: "DSA", semester: 3, title: "Time complexity of quicksort", description: "Why is quicksort O(n log n) on average but O(n^2) in the worst case? What input triggers the worst case?", answer: "Quicksort partitions around a pivot. When the pivot lands near the middle each time, the recursion depth is log n and each level does O(n) work, giving O(n log n). The worst case is when the pivot is always the smallest or largest element — for example an already-sorted array with a first-element pivot — because one partition is empty and the depth becomes n, giving O(n^2). Randomising the pivot or using median-of-three makes that case very unlikely.", verified: true },
  { subject: "DSA", semester: 3, title: "How do hash tables handle collisions", description: "Confused between separate chaining and open addressing. Which is used in practice?", answer: "Both solve the same problem: two keys hashing to the same bucket. Separate chaining stores a list at each bucket, so collisions just append; it degrades gracefully and handles high load factors. Open addressing keeps everything in one array and probes for the next free slot — better cache behaviour, but it needs a load factor well under 1 and deletion requires tombstones. Most language runtimes use one of the two with resizing when the load factor crosses a threshold." },
  { subject: "DSA", semester: 4, title: "Dynamic programming vs memoization", description: "Is memoization the same thing as dynamic programming? When should I use a bottom-up table instead of recursion with caching?", answer: "Memoization is top-down DP: recurse as you naturally would and cache each subproblem result. Tabulation is bottom-up: fill a table from the base cases upward. They compute the same thing with the same complexity. Use memoization when the recursion is easier to reason about or you only need some subproblems; use tabulation when you need all of them anyway, or when recursion depth would overflow the stack." },
  { subject: "DSA", semester: 4, title: "Detecting a cycle in a linked list", description: "How does Floyd's tortoise and hare prove a cycle exists? Why must the two pointers meet?", answer: "Move one pointer one step at a time and another two steps. If there is no cycle the fast pointer reaches the end. If there is a cycle, once both are inside it the gap between them changes by exactly one each step, so the fast pointer closes the distance and must eventually land on the slow one — it cannot jump past without landing on it. It uses O(1) space, unlike the hash-set approach." },
  { subject: "DSA", semester: 3, title: "Difference between array and linked list", description: "Which is better for insertion and deletion, and why is random access O(n) for a linked list?" },
  { subject: "DSA", semester: 4, title: "When should I use a heap instead of sorting", description: "If I only need the top 5 elements, is sorting the whole array wasteful?" },
  { subject: "DSA", semester: 4, title: "Explain recursion stack overflow", description: "My recursive solution crashes on large inputs but the logic looks right." },
  { subject: "DSA", semester: 3, title: "What is the difference between BFS and DFS", description: "Both visit every node, so when does the choice actually matter?", answer: "BFS explores level by level using a queue, DFS goes as deep as possible using a stack or recursion. The choice matters when the structure of the answer matters: BFS finds the shortest path in an unweighted graph because it reaches every node by the fewest edges; DFS does not. DFS uses memory proportional to depth, BFS proportional to the widest level, so on a wide shallow graph DFS is cheaper and on a deep narrow one BFS is." },

  // --- DBMS ---
  { subject: "DBMS", semester: 4, title: "Difference between INNER JOIN and LEFT JOIN", description: "When I use LEFT JOIN I get extra rows with NULLs. What exactly is the difference?", answer: "INNER JOIN returns only rows where the join condition matches on both sides. LEFT JOIN returns every row from the left table, and fills the right-hand columns with NULL where there was no match. So the NULL rows you are seeing are left-table rows with no counterpart — which is usually exactly what you want when you are asking 'show me all students and their marks, including those with none'. A common trap is putting a condition on the right table in WHERE instead of ON, which silently turns a LEFT JOIN back into an INNER JOIN.", verified: true },
  { subject: "DBMS", semester: 4, title: "What is database normalization", description: "Explain 1NF, 2NF and 3NF with a simple table example. Why decompose at all?", answer: "Normalization removes redundancy so that one fact is stored in one place. 1NF: every column holds a single atomic value — no comma-separated lists. 2NF: on top of 1NF, no non-key column depends on only part of a composite key. 3NF: no non-key column depends on another non-key column. The reason to bother is update anomalies: if a department name is duplicated across a hundred student rows, changing it means a hundred updates and one missed row makes the data inconsistent." },
  { subject: "DBMS", semester: 4, title: "ACID properties in transactions", description: "What do atomicity, consistency, isolation and durability actually guarantee?", answer: "Atomicity: a transaction either fully happens or not at all — a transfer cannot debit one account without crediting the other. Consistency: it moves the database from one valid state to another, respecting constraints. Isolation: concurrent transactions do not observe each other's partial work, with the strictness set by the isolation level. Durability: once committed, it survives a crash because it is in the write-ahead log." },
  { subject: "DBMS", semester: 5, title: "SQL error 1452 foreign key constraint fails", description: "Getting 'Cannot add or update a child row: a foreign key constraint fails' when inserting into the orders table.", answer: "That error means the value you are inserting into the foreign key column does not exist in the referenced table's key column. Check three things: that the parent row actually exists, that the types match exactly (an unsigned int referencing a signed one fails), and that you are not inserting the child before the parent inside a transaction. If you are bulk loading, insert parents first or defer constraint checking." },
  { subject: "DBMS", semester: 5, title: "Clustered vs non clustered index", description: "How does a clustered index change physical row order, and why can a table have only one?" },
  { subject: "DBMS", semester: 5, title: "When should I use a view instead of a table", description: "Does a view cost anything at query time?" },
  { subject: "DBMS", semester: 4, title: "What does a foreign key constraint actually do", description: "Is it just documentation or does the database enforce something?" },
  { subject: "DBMS", semester: 5, title: "Difference between DELETE, TRUNCATE and DROP", description: "They all seem to remove data. When does the distinction matter?", answer: "DELETE removes rows one at a time, fires triggers, can be filtered with WHERE, and can be rolled back. TRUNCATE removes all rows by deallocating pages — much faster, but it cannot be filtered, usually resets identity counters, and in some engines cannot be rolled back. DROP removes the table itself, structure included. Rule of thumb: DELETE when you need a subset or an undo, TRUNCATE when emptying a table you intend to keep, DROP when the table should stop existing." },

  // --- OS ---
  { subject: "OS", semester: 4, title: "What causes a deadlock", description: "Explain the four Coffman conditions and how breaking one prevents deadlock.", answer: "Deadlock needs four conditions at once: mutual exclusion (a resource cannot be shared), hold and wait (a process holds one resource while waiting for another), no preemption (resources cannot be forcibly taken), and circular wait (a cycle of processes each waiting on the next). Break any one and deadlock becomes impossible. The usual practical fix is breaking circular wait by imposing a global ordering on lock acquisition — always take lock A before lock B.", verified: true },
  { subject: "OS", semester: 4, title: "Difference between process and thread", description: "Threads share memory but processes do not. What else differs and when do I choose one?", answer: "A process has its own address space, file descriptors and memory; a thread lives inside a process and shares all of that with its siblings, having only its own stack and registers. That makes thread creation and switching much cheaper, and communication trivial — but it also means one thread corrupting memory takes the whole process down, and shared data needs synchronisation. Choose processes for isolation and fault tolerance, threads for cheap concurrency over shared state." },
  { subject: "OS", semester: 5, title: "How does paging work in virtual memory", description: "What are the roles of the page table and the TLB when translating a virtual address?", answer: "A virtual address splits into a page number and an offset. The page number indexes the page table, which gives the physical frame; the offset is added unchanged. Since the page table is itself in memory, every access would cost two memory reads — so the TLB caches recent translations and most lookups hit it. A miss walks the page table; if the page is not resident at all you get a page fault and the OS loads it from disk." },
  { subject: "OS", semester: 5, title: "Round robin scheduling explained", description: "How is the time quantum chosen, and what happens if it is too small or too large?" },
  { subject: "OS", semester: 4, title: "Semaphore vs mutex", description: "Both look like locks. What is the real difference and when is a counting semaphore right?", answer: "A mutex protects a critical section and has an owner — the thread that locked it must unlock it. A semaphore is a counter with no ownership; any thread may signal it. Use a mutex for mutual exclusion over shared data. Use a counting semaphore when you are managing N interchangeable resources, such as a pool of five database connections, or for signalling between threads where the signaller is not the waiter." },
  { subject: "OS", semester: 4, title: "What is thrashing in an operating system", description: "Why does the system slow to a crawl instead of just being a bit slower?" },
  { subject: "OS", semester: 5, title: "Difference between preemptive and non preemptive scheduling", description: "Does the OS always get to interrupt a running process?" },

  // --- NETWORKS ---
  { subject: "NETWORKS", semester: 5, title: "TCP three way handshake", description: "Walk me through SYN, SYN-ACK and ACK. Why three steps instead of two?", answer: "The client sends SYN with its initial sequence number. The server replies SYN-ACK, acknowledging that number and sending its own. The client sends ACK for the server's number. Three steps are needed because both sides must agree on sequence numbers, and each needs confirmation that the other received theirs. Two steps would leave the server unsure whether the client got its sequence number, so it could not safely start sending.", verified: true },
  { subject: "NETWORKS", semester: 5, title: "Difference between TCP and UDP", description: "When would anyone prefer UDP if it does not guarantee delivery or ordering?", answer: "TCP gives you ordered, reliable, connection-oriented delivery with congestion control, at the cost of handshakes, retransmission and head-of-line blocking. UDP gives you none of that and just sends datagrams. That is exactly right when late data is useless: in a voice call, retransmitting a packet from two seconds ago is worse than dropping it. It also suits request-response protocols like DNS where the whole exchange fits in one packet and the application can retry." },
  { subject: "NETWORKS", semester: 5, title: "What does DNS resolution do", description: "How does a hostname become an IP address? What are the recursive resolver and root servers for?" },
  { subject: "NETWORKS", semester: 6, title: "Subnet mask and CIDR notation", description: "How do I work out how many usable hosts a /26 network has, and what the broadcast address is?", answer: "A /26 means 26 bits of network and 6 bits of host. Two to the power of 6 is 64 addresses in the block, minus the network address and the broadcast address, leaving 62 usable hosts. The blocks start every 64 addresses, so for 192.168.1.0/26 the range is .0 to .63, with .0 the network address, .63 the broadcast, and .1 to .62 assignable." },
  { subject: "NETWORKS", semester: 5, title: "What is the difference between a switch and a router", description: "Both forward traffic, so where is the actual boundary?" },
  { subject: "NETWORKS", semester: 6, title: "How does HTTPS actually protect data", description: "Is it just encryption, or is there more to it?" },

  // --- COA ---
  { subject: "COA", semester: 3, title: "Pipelining hazards in a CPU", description: "What are structural, data and control hazards, and how does forwarding help?", answer: "Structural hazards happen when two instructions need the same hardware unit in the same cycle. Data hazards happen when an instruction needs a result that is not written back yet — forwarding solves most of these by routing the ALU output straight to the next instruction's input instead of waiting for the register write. Control hazards come from branches, where the pipeline has already fetched instructions that may be wrong; branch prediction and delay slots reduce the cost.", verified: true },
  { subject: "COA", semester: 3, title: "Cache memory mapping techniques", description: "Direct mapped versus set associative versus fully associative. How are the index and tag computed?", answer: "The address splits into tag, index and block offset. Direct mapped: each memory block maps to exactly one cache line, so the index picks the line and the tag confirms identity — simple and fast, but two hot addresses mapping to one line thrash. Fully associative: a block can sit anywhere, so no conflict misses, but every tag must be compared. Set associative is the compromise: the index picks a set of N lines and the tag is compared within it." },
  { subject: "COA", semester: 3, title: "Two's complement representation", description: "Why does two's complement let subtraction use the same adder as addition?" },
  { subject: "COA", semester: 3, title: "Difference between RISC and CISC", description: "Is one actually faster, or is it just a design philosophy?" },
  { subject: "COA", semester: 3, title: "What is instruction level parallelism", description: "How can a processor run more than one instruction at a time if the program is sequential?" },
];

/**
 * Complaint templates.
 *
 * `duplicateOf` marks a complaint as a differently-worded report of the same
 * fault in the same room, which is what gives CC-13 real clusters to find.
 */
interface SeedComplaint {
  category: string;
  title: string;
  description: string;
  priority: number;
  block: string;
  room: string;
  /**
   * How a second student would report the same fault. Real duplicates are
   * differently worded, not the same title with a suffix — and a suffix would
   * also make the duplicate detection look easier than it is.
   */
  altTitle: string;
  altDescription: string;
  /** Index into this array of the complaint this duplicates. */
  duplicateOf?: number;
}

const COMPLAINTS: SeedComplaint[] = [
  { category: "SMART_BOARD", title: "Projector not switching on", altTitle: "Projector has no power", altDescription: "The projector unit shows no power light at all, nothing happens when we press the button.", description: "The projector in this classroom does not turn on at all. The power light stays off even after checking the socket.", priority: 1, block: "ML", room: "ML03" },
  { category: "SMART_BOARD", title: "Classroom projector is dead", altTitle: "Cannot start the projector", altDescription: "Been trying to get the projector running for ten minutes with no result.", description: "Tried switching the projector on several times before the lecture, no display comes up at all.", priority: 1, block: "ML", room: "ML03", duplicateOf: 0 },
  { category: "SMART_BOARD", title: "Projector will not display anything", altTitle: "Projector shows a blank screen", altDescription: "The projector seems on but the screen stays completely blank.", description: "No image from the projector in this room, we had to cancel the presentation.", priority: 2, block: "ML", room: "ML03", duplicateOf: 0 },

  { category: "FAN", title: "Ceiling fan not working", altTitle: "Fan is completely still", altDescription: "The ceiling fan does not move at all, switch position makes no difference.", description: "The fan in the back half of the room does not spin even when the switch is on. Room gets very hot by noon.", priority: 2, block: "NL", room: "NL22" },
  { category: "FAN", title: "Fan has stopped rotating", altTitle: "No air from the ceiling fan", altDescription: "The fan has stopped and the room is stuffy during afternoon lectures.", description: "One of the ceiling fans stopped completely. It was making noise last week and now it does not move at all.", priority: 2, block: "NL", room: "NL22", duplicateOf: 3 },

  { category: "LIGHT", title: "Tube lights not glowing", altTitle: "Lights do not turn on", altDescription: "Pressing the light switches does nothing for most of the tubes in here.", description: "Half the tube lights in this room do not switch on. It is difficult to read from the back rows.", priority: 2, block: "NL", room: "NL25" },
  { category: "LIGHT", title: "Room lighting is out", altTitle: "Classroom is too dark to read", altDescription: "With the lights not working the back of the room is unusable.", description: "The lights on the left side of the classroom are not working at all.", priority: 2, block: "NL", room: "NL25", duplicateOf: 5 },

  { category: "NETWORK", title: "No wifi connectivity in the lab", altTitle: "Lab wifi will not connect", altDescription: "None of the systems in this lab can join the campus network.", description: "Wifi does not connect on any of the machines in this lab. We cannot access the course portal.", priority: 1, block: "ML", room: "ML07" },
  { category: "NETWORK", title: "Internet is down in this room", altTitle: "Cannot access the network here", altDescription: "No internet access at all in this room since morning.", description: "Cannot get any internet connection here since this morning. Practical work is blocked.", priority: 1, block: "ML", room: "ML07", duplicateOf: 7 },

  { category: "SEATING", title: "Broken chair in the classroom", altTitle: "Damaged seating in this room", altDescription: "A chair back has come away from the frame and is not safe.", description: "One chair has a cracked backrest and is unsafe to sit on. Someone could get hurt.", priority: 3, block: "NL", room: "NL21" },
  { category: "FURNITURE", title: "Desk drawer is jammed", altTitle: "Drawer will not open", altDescription: "The teaching desk drawer is stuck shut with material inside.", description: "The front desk drawer cannot be opened, the teaching material is stuck inside.", priority: 3, block: "ML", room: "ML01" },
  { category: "FAN", title: "Fan making loud rattling noise", altTitle: "Fan is very noisy", altDescription: "The fan runs but the rattling makes it hard to hear the lecture.", description: "The fan spins but rattles very loudly and is distracting during lectures. Different from it not working.", priority: 3, block: "ML", room: "ML05" },
  { category: "SMART_BOARD", title: "Smart board touch not responding", altTitle: "Board does not react to touch", altDescription: "Display is fine but nothing happens when the board is touched.", description: "The display works but touch input does nothing, so the board cannot be written on.", priority: 2, block: "NL", room: "NL24" },
  { category: "LIGHT", title: "Flickering tube light", altTitle: "Light keeps blinking", altDescription: "One tube keeps flickering on and off throughout the class.", description: "One tube light flickers constantly through the lecture and is giving people headaches.", priority: 3, block: "ML", room: "ML06" },
  { category: "SEATING", title: "Not enough benches", altTitle: "Shortage of seating", altDescription: "There are fewer seats than students so some have to stand.", description: "This room has fewer benches than students in the batch, several have to stand.", priority: 2, block: "NL", room: "NL23" },
  { category: "NETWORK", title: "Lab machines cannot reach the server", altTitle: "Systems cannot connect to department server", altDescription: "The lab computers have network but the department server is unreachable.", description: "The lab PCs are on the network but cannot reach the department server.", priority: 2, block: "ML", room: "ML08" },
  { category: "FURNITURE", title: "Whiteboard surface damaged", altTitle: "Whiteboard cannot be cleaned", altDescription: "Marker ink will not wipe off the damaged board surface.", description: "The whiteboard is scratched badly and marker writing cannot be wiped off.", priority: 3, block: "NL", room: "NL26" },
  { category: "FAN", title: "Fan regulator broken", altTitle: "Cannot control fan speed", altDescription: "The regulator has no effect, the fan stays at maximum speed.", description: "The speed regulator does not work, the fan only runs at full speed.", priority: 3, block: "NL", room: "NL27" },
];

/**
 * Re-asks of doubts already in the corpus, worded differently by other
 * students.
 *
 * This is not padding. Students genuinely re-ask questions in their own words,
 * and these pairs are precisely what CC-11 exists to catch and the keyword
 * baseline structurally cannot: "Why does my JOIN produce NULL rows" shares
 * almost nothing lexically with "Difference between INNER JOIN and LEFT JOIN".
 */
const REASKED: Array<{ subject: (typeof SUBJECTS)[number]; semester: number; title: string; description: string }> = [
  { subject: "DSA", semester: 3, title: "Searching a sorted array by halving it", description: "Our lecturer showed a method that keeps cutting the search range in half. I did not follow the logic." },
  { subject: "DSA", semester: 3, title: "Why is my sort slow on already sorted data", description: "My sorting code is fast on random input but crawls when the input is already in order. Why would that happen?" },
  { subject: "DSA", semester: 3, title: "What happens when two keys land in the same bucket", description: "In a hash map, what does the structure do when two different keys compute to the same index?" },
  { subject: "DSA", semester: 4, title: "Is caching recursive results the same as DP", description: "I store results in a dictionary inside my recursion. Is that dynamic programming or something else?" },
  { subject: "DSA", semester: 4, title: "How do I know if a linked list loops forever", description: "My traversal never terminates on some inputs. How do I detect that without extra memory?" },
  { subject: "DBMS", semester: 4, title: "Why does my JOIN produce rows full of NULLs", description: "After changing my query I suddenly get rows where all the right-hand columns are empty. What did I change?" },
  { subject: "DBMS", semester: 4, title: "Why do we split one table into many", description: "It seems simpler to keep everything in one big table. What problem does splitting actually solve?" },
  { subject: "DBMS", semester: 4, title: "What guarantees does a transaction give me", description: "If the power cuts halfway through a transfer, what does the database promise about my data?" },
  { subject: "DBMS", semester: 5, title: "Cannot add or update a child row error", description: "My INSERT keeps failing with a constraint error mentioning a child row. I do not understand what it wants." },
  { subject: "OS", semester: 4, title: "Two processes stuck waiting on each other", description: "My program freezes with both threads waiting and neither making progress. What causes this and how is it avoided?" },
  { subject: "OS", semester: 4, title: "Should I use threads or separate processes", description: "For a program doing several things at once, how do I decide between threads and processes?" },
  { subject: "OS", semester: 5, title: "How does the CPU turn an address into a real memory location", description: "I understand programs use their own addresses. How does that become an actual physical location?" },
  { subject: "OS", semester: 4, title: "Difference between a counting lock and a binary lock", description: "When would I want a lock that allows several holders rather than exactly one?" },
  { subject: "NETWORKS", semester: 5, title: "Why does TCP need three messages to connect", description: "Would two messages not be enough to start a connection? Why the third one?" },
  { subject: "NETWORKS", semester: 5, title: "When is it fine to lose packets", description: "Why would an application choose a protocol that does not guarantee the data arrives?" },
  { subject: "NETWORKS", semester: 6, title: "How many usable addresses in a /26", description: "Working through a subnetting problem and I keep getting the host count wrong." },
  { subject: "COA", semester: 3, title: "Why does the pipeline stall on dependent instructions", description: "When one instruction needs the previous result, the pipeline seems to wait. Can that be avoided?" },
  { subject: "COA", semester: 3, title: "How does the cache decide where to put a block", description: "What determines which cache line a particular memory address ends up in?" },
  { subject: "COA", semester: 3, title: "Why can the same circuit add and subtract", description: "Our notes say subtraction reuses the adder. How is that possible?" },
  { subject: "NETWORKS", semester: 5, title: "How does a name become an IP address", description: "When I type a website name, what actually finds the numeric address for it?" },
];

const COMPLAINT_STATUSES = [
  "RAISED", "RAISED", "ASSIGNED", "ASSIGNED", "IN_PROGRESS", "RESOLVED",
] as const;

/** Deterministic pseudo-random, so re-runs and reviews are reproducible. */
let seedState = 42;
const rand = (): number => {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
};
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

const STUDENT_COUNT = 60;
const FACULTY_COUNT = 6;

const main = async () => {
  const dryRun = process.argv.includes("--dry-run");

  const existing = await prisma.user.count({
    where: { userID: { startsWith: SEED_PREFIX } },
  });

  console.log(`Existing seeded users: ${existing}`);
  console.log(
    `Plan: ${STUDENT_COUNT} students, ${FACULTY_COUNT} faculty, ` +
      `${DOUBTS.length + REASKED.length} doubts ` +
      `(${DOUBTS.filter((d) => d.answer).length} answered, ${REASKED.length} re-asks), ` +
      `~${COMPLAINTS.length * 2} complaints`,
  );
  console.log(
    `Tagging: userID "${SEED_PREFIX}…", email "…${SEED_EMAIL_DOMAIN}"\n`,
  );

  if (dryRun) {
    console.log("--dry-run: nothing written.");
    return;
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  /* ---------------- faculty ---------------- */
  const facultyIds: string[] = [];
  for (let i = 0; i < FACULTY_COUNT; i++) {
    const userID = `${SEED_PREFIX}FAC${String(i + 1).padStart(3, "0")}`;
    const found = await prisma.user.findUnique({ where: { userID } });
    if (found) {
      facultyIds.push(found.id);
      continue;
    }

    const dept = DEPARTMENTS[i % DEPARTMENTS.length]!;
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;

    const user = await prisma.user.create({
      data: {
        name,
        email: `${userID.toLowerCase()}${SEED_EMAIL_DOMAIN}`,
        password: passwordHash,
        userID,
        role: Role.FACULTY,
        approvalStatus: ApprovalStatus.APPROVED,
        isActive: false,
        university: "CampusCure Institute of Technology",
        facultyProfile: {
          create: {
            department: dept.department,
            branch: dept.branch,
            phoneNumber: `98${String(10000000 + i).slice(0, 8)}`,
            address: `${dept.branch} Department, Staff Room ${i + 1}`,
            subjects: [...SUBJECTS].slice(i % 2, (i % 2) + 3),
          },
        },
      },
    });
    facultyIds.push(user.id);
  }
  console.log(`faculty: ${facultyIds.length}`);

  /* ---------------- students ---------------- */
  const studentIds: string[] = [];
  for (let i = 0; i < STUDENT_COUNT; i++) {
    const userID = `${SEED_PREFIX}STU${String(i + 1).padStart(3, "0")}`;
    const found = await prisma.user.findUnique({ where: { userID } });
    if (found) {
      studentIds.push(found.id);
      continue;
    }

    const dept = DEPARTMENTS[i % DEPARTMENTS.length]!;
    const semester = 3 + (i % 4);
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;

    const user = await prisma.user.create({
      data: {
        name,
        email: `${userID.toLowerCase()}${SEED_EMAIL_DOMAIN}`,
        password: passwordHash,
        userID,
        role: Role.STUDENT,
        approvalStatus: ApprovalStatus.APPROVED,
        isActive: false,
        university: "CampusCure Institute of Technology",
        studentProfile: {
          create: {
            enrollmentNumber: userID,
            department: dept.department,
            branch: dept.branch,
            semester,
            phoneNumber: `97${String(20000000 + i).slice(0, 8)}`,
            address: `${dept.branch} Hostel, Room ${100 + i}`,
            guardianName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
            guardianPhone: `96${String(30000000 + i).slice(0, 8)}`,
          },
        },
      },
    });
    studentIds.push(user.id);
  }
  console.log(`students: ${studentIds.length}`);

  /* ---------------- doubts and answers ---------------- */
  let doubtsCreated = 0;
  let answersCreated = 0;

  for (const [index, seed] of DOUBTS.entries()) {
    const author = studentIds[index % studentIds.length]!;

    const duplicate = await prisma.doubt.findFirst({
      where: { title: seed.title, postedById: author },
      select: { id: true },
    });
    if (duplicate) continue;

    const doubt = await prisma.doubt.create({
      data: {
        title: seed.title,
        description: seed.description,
        subject: seed.subject,
        semester: seed.semester,
        labels: [seed.subject.toLowerCase()],
        postedById: author,
        status: seed.answer ? DoubtStatus.ANSWERED : DoubtStatus.OPEN,
        answerCount: seed.answer ? 1 : 0,
        views: Math.floor(rand() * 60),
        upVoteCount: Math.floor(rand() * 8),
        createdAt: daysAgo(5 + Math.floor(rand() * 60)),
      },
      select: { id: true },
    });
    doubtsCreated++;
    await enqueueEmbedding("doubt", doubt.id);

    if (seed.answer) {
      await prisma.answer.create({
        data: {
          doubtId: doubt.id,
          content: seed.answer,
          answeredById: pick(facultyIds),
          approvalStatus: ApprovalStatus.APPROVED,
          isVerified: seed.verified ?? false,
          upvotes: Math.floor(rand() * 12),
          createdAt: daysAgo(2 + Math.floor(rand() * 20)),
        },
      });
      answersCreated++;
    }
  }
  // Re-asks, posted by different students so they look like genuine repeats.
  for (const [index, seed] of REASKED.entries()) {
    const author = studentIds[(index * 5 + 11) % studentIds.length]!;

    const duplicate = await prisma.doubt.findFirst({
      where: { title: seed.title, postedById: author },
      select: { id: true },
    });
    if (duplicate) continue;

    const doubt = await prisma.doubt.create({
      data: {
        title: seed.title,
        description: seed.description,
        subject: seed.subject,
        semester: seed.semester,
        labels: [seed.subject.toLowerCase()],
        postedById: author,
        status: DoubtStatus.OPEN,
        views: Math.floor(rand() * 30),
        upVoteCount: Math.floor(rand() * 4),
        createdAt: daysAgo(1 + Math.floor(rand() * 25)),
      },
      select: { id: true },
    });
    doubtsCreated++;
    await enqueueEmbedding("doubt", doubt.id);
  }

  console.log(`doubts: ${doubtsCreated} (${answersCreated} answered)`);

  /* ---------------- complaints ---------------- */
  let complaintsCreated = 0;

  // Two passes: the templates once, then a second round by different students,
  // which produces additional natural duplicates on top of the explicit ones.
  for (const pass of [0, 1]) {
    for (const [index, seed] of COMPLAINTS.entries()) {
      const raiser = studentIds[(index * 3 + pass * 7) % studentIds.length]!;

      const title = pass === 0 ? seed.title : seed.altTitle;
      const duplicate = await prisma.complaint.findFirst({
        where: { title, raisedById: raiser },
        select: { id: true },
      });
      if (duplicate) continue;

      const status = pick(COMPLAINT_STATUSES);
      const assigned = status !== "RAISED" ? pick(facultyIds) : null;

      const complaint = await prisma.complaint.create({
        data: {
          title,
          description: pass === 0 ? seed.description : seed.altDescription,
          category: seed.category,
          priority: seed.priority,
          block: seed.block,
          classroomNumber: seed.room,
          status: status as never,
          raisedById: raiser,
          ...(assigned ? { assignedToId: assigned, assignedAt: daysAgo(3) } : {}),
          ...(status === "RESOLVED"
            ? {
                resolutionNote: "Checked by maintenance and fixed.",
                resolutionDate: daysAgo(1),
              }
            : {}),
          createdAt: daysAgo(2 + Math.floor(rand() * 40)),
        },
        select: { id: true },
      });
      complaintsCreated++;
      await enqueueEmbedding("complaint", complaint.id);
    }
  }
  console.log(`complaints: ${complaintsCreated}`);

  console.log(
    `\nEmbedding jobs queued. Run:\n  npx tsx src/scripts/backfillEmbeddings.ts`,
  );
  console.log(`\nSeeded accounts use the password: ${SEED_PASSWORD}`);
  console.log(
    `These are real loginable accounts. Remove them after the demo:\n` +
      `  npx tsx src/scripts/removeDemoData.ts`,
  );
};

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
