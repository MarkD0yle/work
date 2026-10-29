/* Plain-English definitions for every piece of market jargon on the Studio
 * screens. One place, so a term means the same thing everywhere. */

export const GLOSSARY = {
  OAS: "Option-adjusted spread: the extra yield a bond pays over Treasuries, in basis points. Higher = riskier or cheaper.",
  bp: "Basis point: one hundredth of a percent. 25 bp = 0.25%.",
  z: "How unusual today's move is versus the last 3 months. Beyond ±2 is rare.",
  IG: "Investment grade: bonds rated BBB or better.",
  HY: "High yield: bonds rated below BBB. Pay more, carry more risk.",
  TRACE: "The public US tape of corporate bond trades. Prints here are delayed 15 minutes.",
  RFQ: "Request for quote: you ask several dealers for a price at the same time and pick the best.",
  composite: "COMP — a blended market price from many sources. Used as the fair-value reference.",
  cover: "The second-best quote. How close it is to the best tells you how competitive the price was.",
  axe: "A dealer who has told the market they want to buy or sell this bond. Usually prices sharper.",
  hitRate: "How often you have traded with this dealer when you asked them, last 90 days.",
  liftHit: "Lift = buy at a dealer's offer. Hit = sell at a dealer's bid.",
  DV01: "Dollar value of 1 bp: how much the position gains or loses if yields move 0.01%.",
  CS01: "Like DV01, but for a 1 bp move in credit spread only.",
  PV01: "Price change for a 1 bp move in yield, per $1MM face.",
  accrued: "Interest earned since the last coupon. The buyer pays it to the seller on top of the price.",
  gSpread: "Yield over the matching on-the-run Treasury, in basis points.",
  TIF: "Time in force: how long the order stays live. Day, GTC (good till cancelled) or IOC (fill now or cancel).",
  ADV: "Average daily volume traded in this bond over the last 20 days.",
  BWIC: "Bids wanted in competition: you send a list of bonds to dealers and sell each line to the best bid.",
  mark: "Our own valuation of the bond today. Bids are compared against it.",
  reserve: "The lowest price you will accept. Lines below it don't trade unless you override.",
  DNT: "Do not trade: hold the line back.",
  DNB: "Did not bid: the dealer passed on this line.",
  richCheap: "Cheap = yield above the fitted curve (good to buy). Rich = yield below it (good to sell).",
  OTR: "On-the-run: the newest, most traded Treasury at each maturity.",
  fly: "Butterfly: 2 × the middle yield minus the two ends. Shows if the belly is cheap or rich to the wings.",
  switch: "Sell one bond and buy another in one package, keeping interest-rate risk the same.",
  carry: "What the position earns (or costs) over 3 months if nothing moves, including rolling down the curve.",
  curveSpread: "The yield gap between two maturities, e.g. 2s10s = 10-year minus 2-year.",
  fillProb: "Our estimate of the chance this limit fills today, based on where it sits against the market.",
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
