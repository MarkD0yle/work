/* Awesome Quant — a curated catalogue of quantitative-finance libraries,
 * packages and services, mirrored from the community list at
 * https://github.com/wilsonfreitas/awesome-quant (MIT / CC0).
 *
 * This is reference data only: no charts, no mock trading state — the
 * awesome-quant page renders it as a searchable, filterable directory.
 * To refresh, re-derive the entries from the upstream README.
 */

/** A sub-entry: a language port, add-on or sibling package of a resource. */
export type QuantResourceChild = {
  name: string;
  /** Null for entries the upstream list mentions without a canonical link. */
  url: string | null;
  description: string;
};

export type QuantResource = {
  name: string;
  url: string;
  /** Source repo, when the primary link points at docs or a homepage instead. */
  repo?: string;
  /** Language / interface tags, e.g. "Python", "R", "MCP". */
  tags: string[];
  description: string;
  /** Upstream flags the project as no longer maintained. */
  archived?: boolean;
  children?: QuantResourceChild[];
};

export type QuantCategory = {
  name: string;
  entries: QuantResource[];
};

export const AWESOME_QUANT_URL =
  "https://github.com/wilsonfreitas/awesome-quant";

/** Date the catalogue below was last mirrored from upstream. */
export const AWESOME_QUANT_SYNCED = "2026-08-17";

export const AWESOME_QUANT: QuantCategory[] = [
  {
    name: "Numerical Libraries & Data Structures",
    entries: [
      {
        name: "numpy",
        url: "https://www.numpy.org",
        repo: "https://github.com/numpy/numpy",
        tags: ["Python"],
        description:
          "NumPy is the fundamental package for scientific computing with Python.",
      },
      {
        name: "scipy",
        url: "https://www.scipy.org",
        repo: "https://github.com/scipy/scipy",
        tags: ["Python"],
        description:
          "SciPy (pronounced “Sigh Pie”) is a Python-based ecosystem of open-source software for mathematics, science, and engineering.",
      },
      {
        name: "pandas",
        url: "https://pandas.pydata.org",
        repo: "https://github.com/pandas-dev/pandas",
        tags: ["Python"],
        description:
          "pandas is an open source, BSD-licensed library providing high-performance, easy-to-use data structures and data analysis tools for the Python programming language.",
      },
      {
        name: "polars",
        url: "https://docs.pola.rs/",
        repo: "https://github.com/pola-rs/polars",
        tags: ["Python"],
        description:
          "Polars is a blazingly fast DataFrame library for manipulating structured data.",
      },
      {
        name: "quantdsl",
        url: "https://github.com/johnbywater/quantdsl",
        repo: "https://github.com/johnbywater/quantdsl",
        tags: ["Python"],
        description:
          "Domain specific language for quantitative analytics in finance and trading.",
      },
      {
        name: "statistics",
        url: "https://docs.python.org/3/library/statistics.html",
        tags: ["Python"],
        description:
          "Builtin Python library for all basic statistical calculations.",
      },
      {
        name: "sympy",
        url: "https://www.sympy.org/",
        repo: "https://github.com/sympy/sympy",
        tags: ["Python"],
        description:
          "SymPy is a Python library for symbolic mathematics.",
      },
      {
        name: "pymc3",
        url: "https://docs.pymc.io/",
        repo: "https://github.com/pymc-devs/pymc",
        tags: ["Python"],
        description:
          "Probabilistic Programming in Python: Bayesian Modeling and Probabilistic Machine Learning with Theano.",
      },
      {
        name: "modelx",
        url: "https://docs.modelx.io/",
        repo: "https://github.com/fumitoh/modelx",
        tags: ["Python"],
        description:
          "Python reimagination of spreadsheets as formula-centric objects that are interoperable with pandas.",
      },
      {
        name: "ArcticDB",
        url: "https://github.com/man-group/ArcticDB",
        repo: "https://github.com/man-group/ArcticDB",
        tags: ["Python"],
        description:
          "High performance datastore for time series and tick data.",
      },
      {
        name: "CRNG",
        url: "https://github.com/brotto/crng",
        repo: "https://github.com/brotto/crng",
        tags: ["Python"],
        description:
          "Contingency Random Number Generator that produces random numbers with real financial market statistical signatures (fat tails, volatility clustering, kurtosis). Matches 86% of real market metrics vs 14% for NumPy.",
      },
      {
        name: "xts",
        url: "https://github.com/joshuaulrich/xts",
        repo: "https://github.com/joshuaulrich/xts",
        tags: ["R"],
        description:
          "eXtensible Time Series: Provide for uniform handling of R's different time-based data classes by extending zoo, maximizing native format information preservation and allowing for user level customization and extension, while simplifying cross-class interoperability.",
      },
      {
        name: "data.table",
        url: "https://github.com/Rdatatable/data.table",
        repo: "https://github.com/Rdatatable/data.table",
        tags: ["R"],
        description:
          "Extension of data.frame: Fast aggregation of large data (e.g. 100GB in RAM), fast ordered joins, fast add/modify/delete of columns by group using no copies at all, list columns and a fast file reader (fread). Offers a natural and flexible syntax, for faster development.",
      },
      {
        name: "sparseEigen",
        url: "https://github.com/dppalomar/sparseEigen",
        repo: "https://github.com/dppalomar/sparseEigen",
        tags: ["R"],
        description:
          "Sparse principal component analysis.",
      },
      {
        name: "TSdbi",
        url: "http://tsdbi.r-forge.r-project.org/",
        tags: ["R"],
        description:
          "Provides a common interface to time series databases.",
      },
      {
        name: "tseries",
        url: "https://cran.r-project.org/web/packages/tseries/index.html",
        tags: ["R"],
        description:
          "Time Series Analysis and Computational Finance.",
      },
      {
        name: "zoo",
        url: "https://cran.r-project.org/web/packages/zoo/index.html",
        tags: ["R"],
        description:
          "S3 Infrastructure for Regular and Irregular Time Series (Z's Ordered Observations).",
      },
      {
        name: "tis",
        url: "https://cran.r-project.org/web/packages/tis/index.html",
        tags: ["R"],
        description:
          "Functions and S3 classes for time indexes and time indexed series, which are compatible with FAME frequencies.",
      },
      {
        name: "tfplot",
        url: "https://cran.r-project.org/web/packages/tfplot/index.html",
        tags: ["R"],
        description:
          "Utilities for simple manipulation and quick plotting of time series data.",
      },
      {
        name: "tframe",
        url: "https://cran.r-project.org/web/packages/tframe/index.html",
        tags: ["R"],
        description:
          "A kernel of functions for programming time series methods in a way that is relatively independently of the representation of time.",
      },
      {
        name: "Temporal.jl",
        url: "https://github.com/dysonance/Temporal.jl",
        repo: "https://github.com/dysonance/Temporal.jl",
        tags: ["Julia"],
        description:
          "Flexible and efficient time series class & methods.",
      },
      {
        name: "DataFrames.jl",
        url: "https://github.com/JuliaData/DataFrames.jl",
        repo: "https://github.com/JuliaData/DataFrames.jl",
        tags: ["Julia"],
        description:
          "In-memory tabular data in Julia.",
      },
      {
        name: "TSFrames.jl",
        url: "https://github.com/xKDR/TSFrames.jl",
        repo: "https://github.com/xKDR/TSFrames.jl",
        tags: ["Julia"],
        description:
          "Handle timeseries data on top of the powerful and mature DataFrames.jl.",
      },
      {
        name: "TimeArrays.jl",
        url: "https://github.com/bhftbootcamp/TimeArrays.jl",
        repo: "https://github.com/bhftbootcamp/TimeArrays.jl",
        tags: ["Julia"],
        description:
          "Time series handling for Julia.",
      },
      {
        name: "jacobian",
        url: "https://github.com/morluto/jacobian",
        repo: "https://github.com/morluto/jacobian",
        tags: ["Python", "MCP"],
        description:
          "Exact computation and conjecture testing across polynomial maps, linear algebra, and graph algorithms for agent-driven mathematical research.",
      },
    ],
  },
  {
    name: "Financial Instruments & Pricing",
    entries: [
      {
        name: "PyQL",
        url: "https://github.com/enthought/pyql",
        repo: "https://github.com/enthought/pyql",
        tags: ["Python"],
        description:
          "QuantLib's Python port.",
      },
      {
        name: "pyfin",
        url: "https://github.com/opendoor-labs/pyfin",
        repo: "https://github.com/opendoor-labs/pyfin",
        tags: ["Python"],
        description:
          "Basic options pricing in Python.",
        archived: true,
      },
      {
        name: "vollib",
        url: "https://github.com/vollib/vollib",
        repo: "https://github.com/vollib/vollib",
        tags: ["Python"],
        description:
          "vollib is a python library for calculating option prices, implied volatility and greeks.",
      },
      {
        name: "py_vollib",
        url: "https://github.com/vollib/py_vollib",
        repo: "https://github.com/vollib/py_vollib",
        tags: ["Python"],
        description:
          "vollib Python implementation.",
      },
      {
        name: "vanilla-option-pricers",
        url: "https://github.com/ArturSepp/VanillaOptionPricers",
        repo: "https://github.com/ArturSepp/VanillaOptionPricers",
        tags: ["Python"],
        description:
          "Fast, vectorised Black-Scholes-Merton and Bachelier pricers and implied volatility fitters, including inverse options for crypto derivatives.",
      },
      {
        name: "StochVolModels",
        url: "https://github.com/ArturSepp/StochVolModels",
        repo: "https://github.com/ArturSepp/StochVolModels",
        tags: ["Python"],
        description:
          "Pricing analytics and Monte Carlo simulation for stochastic volatility models, including the log-normal SV model and the Heston model.",
      },
      {
        name: "QuantPy",
        url: "https://github.com/jsmidt/QuantPy",
        repo: "https://github.com/jsmidt/QuantPy",
        tags: ["Python"],
        description:
          "A framework for quantitative finance In python.",
      },
      {
        name: "Finance-Python",
        url: "https://github.com/alpha-miner/Finance-Python",
        repo: "https://github.com/alpha-miner/Finance-Python",
        tags: ["Python"],
        description:
          "Python tools for Finance.",
      },
      {
        name: "ffn",
        url: "https://github.com/pmorissette/ffn",
        repo: "https://github.com/pmorissette/ffn",
        tags: ["Python"],
        description:
          "A financial function library for Python.",
      },
      {
        name: "pynance",
        url: "https://github.com/GriffinAustin/pynance",
        repo: "https://github.com/GriffinAustin/pynance",
        tags: ["Python"],
        description:
          "Lightweight Python library for assembling and analyzing financial data.",
      },
      {
        name: "tia",
        url: "https://github.com/bpsmith/tia",
        repo: "https://github.com/bpsmith/tia",
        tags: ["Python"],
        description:
          "Toolkit for integration and analysis.",
      },
      {
        name: "pysabr",
        url: "https://github.com/ynouri/pysabr",
        repo: "https://github.com/ynouri/pysabr",
        tags: ["Python"],
        description:
          "SABR model Python implementation.",
      },
      {
        name: "FinancePy",
        url: "https://github.com/domokane/FinancePy",
        repo: "https://github.com/domokane/FinancePy",
        tags: ["Python"],
        description:
          "A Python Finance Library that focuses on the pricing and risk-management of Financial Derivatives, including fixed-income, equity, FX and credit derivatives.",
      },
      {
        name: "gs-quant",
        url: "https://github.com/goldmansachs/gs-quant",
        repo: "https://github.com/goldmansachs/gs-quant",
        tags: ["Python"],
        description:
          "Python toolkit for quantitative finance.",
      },
      {
        name: "willowtree",
        url: "https://github.com/federicomariamassari/willowtree",
        repo: "https://github.com/federicomariamassari/willowtree",
        tags: ["Python"],
        description:
          "Robust and flexible Python implementation of the willow tree lattice for derivatives pricing.",
      },
      {
        name: "financial-engineering",
        url: "https://github.com/federicomariamassari/financial-engineering",
        repo: "https://github.com/federicomariamassari/financial-engineering",
        tags: ["Python"],
        description:
          "Applications of Monte Carlo methods to financial engineering projects, in Python.",
      },
      {
        name: "optlib",
        url: "https://github.com/dbrojas/optlib",
        repo: "https://github.com/dbrojas/optlib",
        tags: ["Python"],
        description:
          "A library for financial options pricing written in Python.",
      },
      {
        name: "tf-quant-finance",
        url: "https://github.com/google/tf-quant-finance",
        repo: "https://github.com/google/tf-quant-finance",
        tags: ["Python"],
        description:
          "High-performance TensorFlow library for quantitative finance.",
      },
      {
        name: "Q-Fin",
        url: "https://github.com/RomanMichaelPaolucci/Q-Fin",
        repo: "https://github.com/RomanMichaelPaolucci/Q-Fin",
        tags: ["Python"],
        description:
          "A Python library for mathematical finance.",
      },
      {
        name: "Quantsbin",
        url: "https://github.com/quantsbin/Quantsbin",
        repo: "https://github.com/quantsbin/Quantsbin",
        tags: ["Python"],
        description:
          "Tools for pricing and plotting of vanilla option prices, greeks and various other analysis around them.",
      },
      {
        name: "finoptions",
        url: "https://github.com/bbcho/finoptions-dev",
        repo: "https://github.com/bbcho/finoptions-dev",
        tags: ["Python"],
        description:
          "Complete python implementation of R package fOptions with partial implementation of fExoticOptions for pricing various options.",
      },
      {
        name: "pypme",
        url: "https://github.com/ymyke/pypme",
        repo: "https://github.com/ymyke/pypme",
        tags: ["Python"],
        description:
          "PME (Public Market Equivalent) calculation.",
      },
      {
        name: "AbsBox",
        url: "https://github.com/yellowbean/AbsBox",
        repo: "https://github.com/yellowbean/AbsBox",
        tags: ["Python"],
        description:
          "A Python based library to model cashflow for structured product like Asset-backed securities (ABS) and Mortgage-backed securities (MBS).",
      },
      {
        name: "mortgagemath",
        url: "https://github.com/murraystokely/mortgagemath",
        repo: "https://github.com/murraystokely/mortgagemath",
        tags: ["Python"],
        description:
          "Cent-accurate mortgage amortization schedules with Decimal arithmetic and published-source validation across six countries.",
      },
      {
        name: "Intrinsic-Value-Calculator",
        url: "https://github.com/akashaero/Intrinsic-Value-Calculator",
        repo: "https://github.com/akashaero/Intrinsic-Value-Calculator",
        tags: ["Python"],
        description:
          "A Python tool for quick calculations of a stock's fair value using Discounted Cash Flow analysis.",
      },
      {
        name: "Kelly-Criterion",
        url: "https://github.com/deltaray-io/kelly-criterion",
        repo: "https://github.com/deltaray-io/kelly-criterion",
        tags: ["Python"],
        description:
          "Kelly Criterion implemented in Python to size portfolios based on J. L. Kelly Jr's formula.",
      },
      {
        name: "rateslib",
        url: "https://github.com/attack68/rateslib",
        repo: "https://github.com/attack68/rateslib",
        tags: ["Python"],
        description:
          "A fixed income library for pricing bonds and bond futures, and derivatives such as IRS, cross-currency and FX swaps.",
      },
      {
        name: "fypy",
        url: "https://github.com/jkirkby3/fypy",
        repo: "https://github.com/jkirkby3/fypy",
        tags: ["Python"],
        description:
          "Vanilla and exotic option pricing library to support quantitative R&D. Focus on pricing interesting/useful models and contracts (including and beyond Black-Scholes), as well as calibration of financial models to market data.",
      },
      {
        name: "Pyderivatives",
        url: "https://github.com/Julian-Beatty/Pyderivatives",
        repo: "https://github.com/Julian-Beatty/Pyderivatives",
        tags: ["Python"],
        description:
          "Toolkit for option pricing, implied volatility surfaces, risk-neutral densities, and pricing kernel surfaces with support for advanced models including Heston, Kou, and Bates.",
      },
      {
        name: "quantra",
        url: "https://github.com/joseprupi/quantraserver",
        repo: "https://github.com/joseprupi/quantraserver",
        tags: ["Python"],
        description:
          "High-performance pricing engine built on QuantLib. It exposes QuantLib's functionality through gRPC and REST APIs, enabling distributed computations with FlatBuffers serialization.",
      },
      {
        name: "optionlab",
        url: "https://github.com/rgaveiga/optionlab",
        repo: "https://github.com/rgaveiga/optionlab",
        tags: ["Python"],
        description:
          "A Python library for evaluating option trading strategies.",
      },
      {
        name: "flashalpha",
        url: "https://github.com/FlashAlpha-lab/flashalpha-python",
        repo: "https://github.com/FlashAlpha-lab/flashalpha-python",
        tags: ["Python"],
        description:
          "Python client for the FlashAlpha options analytics API.",
      },
      {
        name: "QuantOracle",
        url: "https://github.com/QuantOracledev/quantoracle",
        repo: "https://github.com/QuantOracledev/quantoracle",
        tags: ["Python"],
        description:
          "Free quant finance API with 63 deterministic endpoints + 15 free interactive calculators at quantoracle.dev. Options pricing with full Greeks, Monte Carlo, Kelly, VaR, Sharpe, CAGR, crypto liquidation, impermanent loss, plus live crypto volatility/funding data and 24/7 position monitoring with webhook alerts. 1,000 free calls/day, no API key.",
      },
      {
        name: "BDE Score",
        url: "https://github.com/hbhqq9/bde-score",
        repo: "https://github.com/hbhqq9/bde-score",
        tags: ["Python"],
        description:
          "Multi-factor quantitative stock analysis MCP server for US, HK, and CN A-share markets. Transparent 0-100 scoring from 40+ indicators. Listed on Official MCP Registry.",
      },
      {
        name: "implied-expectations",
        url: "https://github.com/Keenan-ux/implied-expectations",
        repo: "https://github.com/Keenan-ux/implied-expectations",
        tags: ["Python"],
        description:
          "Reverse DCF that solves for the revenue growth, duration, and operating margin a stock price implies, from SEC EDGAR fundamentals.",
      },
      {
        name: "RQuantLib",
        url: "https://github.com/eddelbuettel/rquantlib",
        repo: "https://github.com/eddelbuettel/rquantlib",
        tags: ["R"],
        description:
          "RQuantLib connects GNU R with QuantLib.",
      },
      {
        name: "quantmod",
        url: "https://cran.r-project.org/web/packages/quantmod/index.html",
        repo: "https://github.com/joshuaulrich/quantmod",
        tags: ["R"],
        description:
          "Quantitative Financial Modelling Framework.",
      },
      {
        name: "Rmetrics",
        url: "https://www.rmetrics.org",
        tags: ["R"],
        description:
          "The premier open source software solution for teaching and training quantitative finance.",
        children: [
          {
            name: "fAsianOptions",
            url: "https://cran.r-project.org/web/packages/fAsianOptions/index.html",
            description: "EBM and Asian Option Valuation.",
          },
          {
            name: "fAssets",
            url: "https://cran.r-project.org/web/packages/fAssets/index.html",
            description: "Analysing and Modelling Financial Assets.",
          },
          {
            name: "fBasics",
            url: "https://cran.r-project.org/web/packages/fBasics/index.html",
            description: "Markets and Basic Statistics.",
          },
          {
            name: "fBonds",
            url: "https://cran.r-project.org/web/packages/fBonds/index.html",
            description: "Bonds and Interest Rate Models.",
          },
          {
            name: "fExoticOptions",
            url: "https://cran.r-project.org/web/packages/fExoticOptions/index.html",
            description: "Exotic Option Valuation.",
          },
          {
            name: "fOptions",
            url: "https://cran.r-project.org/web/packages/fOptions/index.html",
            description: "Pricing and Evaluating Basic Options.",
          },
          {
            name: "fPortfolio",
            url: "https://cran.r-project.org/web/packages/fPortfolio/index.html",
            description: "Portfolio Selection and Optimization.",
          },
        ],
      },
      {
        name: "sde",
        url: "https://cran.r-project.org/web/packages/sde/index.html",
        tags: ["R"],
        description:
          "Simulation and Inference for Stochastic Differential Equations.",
      },
      {
        name: "YieldCurve",
        url: "https://cran.r-project.org/web/packages/YieldCurve/index.html",
        tags: ["R"],
        description:
          "Modelling and estimation of the yield curve.",
      },
      {
        name: "SmithWilsonYieldCurve",
        url: "https://cran.r-project.org/web/packages/SmithWilsonYieldCurve/index.html",
        tags: ["R"],
        description:
          "Constructs a yield curve by the Smith-Wilson method from a table of LIBOR and SWAP rates.",
      },
      {
        name: "ycinterextra",
        url: "https://cran.r-project.org/web/packages/ycinterextra/index.html",
        tags: ["R"],
        description:
          "Yield curve or zero-coupon prices interpolation and extrapolation.",
      },
      {
        name: "AmericanCallOpt",
        url: "https://cran.r-project.org/web/packages/AmericanCallOpt/index.html",
        tags: ["R"],
        description:
          "This package includes pricing function for selected American call options with underlying assets that generate payouts.",
      },
      {
        name: "VarSwapPrice",
        url: "https://cran.r-project.org/web/packages/VarSwapPrice/index.html",
        tags: ["R"],
        description:
          "Pricing a variance swap on an equity index.",
      },
      {
        name: "RND",
        url: "https://cran.r-project.org/web/packages/RND/index.html",
        tags: ["R"],
        description:
          "Risk Neutral Density Extraction Package.",
      },
      {
        name: "LSMonteCarlo",
        url: "https://cran.r-project.org/web/packages/LSMonteCarlo/index.html",
        tags: ["R"],
        description:
          "American options pricing with Least Squares Monte Carlo method.",
      },
      {
        name: "OptHedging",
        url: "https://cran.r-project.org/web/packages/OptHedging/index.html",
        tags: ["R"],
        description:
          "Estimation of value and hedging strategy of call and put options.",
      },
      {
        name: "tvm",
        url: "https://cran.r-project.org/web/packages/tvm/index.html",
        tags: ["R"],
        description:
          "Time Value of Money Functions.",
      },
      {
        name: "OptionPricing",
        url: "https://cran.r-project.org/web/packages/OptionPricing/index.html",
        tags: ["R"],
        description:
          "Option Pricing with Efficient Simulation Algorithms.",
      },
      {
        name: "credule",
        url: "https://github.com/blenezet/credule",
        repo: "https://github.com/blenezet/credule",
        tags: ["R"],
        description:
          "Credit Default Swap Functions.",
      },
      {
        name: "derivmkts",
        url: "https://cran.r-project.org/web/packages/derivmkts/index.html",
        repo: "https://github.com/rmcd1024/derivmkts",
        tags: ["R"],
        description:
          "Functions and R Code to Accompany Derivatives Markets.",
      },
      {
        name: "FinCal",
        url: "https://github.com/felixfan/FinCal",
        repo: "https://github.com/felixfan/FinCal",
        tags: ["R"],
        description:
          "Package for time value of money calculation, time series analysis and computational finance.",
      },
      {
        name: "r-quant",
        url: "https://github.com/artyyouth/r-quant",
        repo: "https://github.com/artyyouth/r-quant",
        tags: ["R"],
        description:
          "R code for quantitative analysis in finance.",
      },
      {
        name: "options.studies",
        url: "https://github.com/taylorizing/options.studies",
        repo: "https://github.com/taylorizing/options.studies",
        tags: ["R"],
        description:
          "options trading studies functions for use with options.data package and shiny.",
      },
      {
        name: "fmbasics",
        url: "https://github.com/imanuelcostigan/fmbasics",
        repo: "https://github.com/imanuelcostigan/fmbasics",
        tags: ["R"],
        description:
          "Financial Market Building Blocks.",
      },
      {
        name: "R-fixedincome",
        url: "https://github.com/wilsonfreitas/R-fixedincome",
        repo: "https://github.com/wilsonfreitas/R-fixedincome",
        tags: ["R"],
        description:
          "Fixed income tools for R.",
      },
      {
        name: "QuantLib.jl",
        url: "https://github.com/pazzo83/QuantLib.jl",
        repo: "https://github.com/pazzo83/QuantLib.jl",
        tags: ["Julia"],
        description:
          "Quantlib implementation in pure Julia.",
      },
      {
        name: "Ito.jl",
        url: "https://github.com/aviks/Ito.jl",
        repo: "https://github.com/aviks/Ito.jl",
        tags: ["Julia"],
        description:
          "A Julia package for quantitative finance.",
      },
      {
        name: "Miletus.jl",
        url: "https://github.com/JuliaComputing/Miletus.jl",
        repo: "https://github.com/JuliaComputing/Miletus.jl",
        tags: ["Julia"],
        description:
          "A financial contract definition, modeling language, and valuation framework.",
      },
      {
        name: "Strata",
        url: "http://strata.opengamma.io/",
        repo: "https://github.com/OpenGamma/Strata",
        tags: ["Java"],
        description:
          "Modern open-source analytics and market risk library designed and written in Java.",
      },
      {
        name: "JQuantLib",
        url: "https://github.com/frgomes/jquantlib",
        repo: "https://github.com/frgomes/jquantlib",
        tags: ["Java"],
        description:
          "JQuantLib is a free, open-source, comprehensive framework for quantitative finance, written in 100% Java.",
      },
      {
        name: "finmath.net",
        url: "http://finmath.net",
        repo: "https://github.com/finmath/finmath-lib",
        tags: ["Java"],
        description:
          "Java library with algorithms and methodologies related to mathematical finance.",
      },
      {
        name: "quantcomponents",
        url: "https://github.com/lsgro/quantcomponents",
        repo: "https://github.com/lsgro/quantcomponents",
        tags: ["Java"],
        description:
          "Free Java components for Quantitative Finance and Algorithmic Trading.",
      },
      {
        name: "DRIP",
        url: "https://lakshmidrip.github.io/DRIP",
        tags: ["Java"],
        description:
          "Fixed Income, Asset Allocation, Transaction Cost Analysis, XVA Metrics Libraries.",
      },
      {
        name: "finance.js",
        url: "https://github.com/ebradyjobory/finance.js",
        repo: "https://github.com/ebradyjobory/finance.js",
        tags: ["JavaScript"],
        description:
          "A JavaScript library for common financial calculations.",
      },
      {
        name: "hagan-sabr",
        url: "https://github.com/moshejs/hagan-sabr",
        repo: "https://github.com/moshejs/hagan-sabr",
        tags: ["TypeScript"],
        description:
          "SABR stochastic-volatility model (Hagan 2002 lognormal/normal expansions, Obłój correction, smile calibration); zero dependencies, matches QuantLib's sabrVolatility to 1e-9.",
      },
      {
        name: "svi-vol-surface",
        url: "https://github.com/moshejs/svi-vol-surface",
        repo: "https://github.com/moshejs/svi-vol-surface",
        tags: ["TypeScript"],
        description:
          "Gatheral SVI volatility surface (raw/natural/jump-wings), butterfly and calendar arbitrage checks, slice calibration; zero dependencies.",
      },
      {
        name: "compounded-sofr",
        url: "https://github.com/moshejs/compounded-sofr",
        repo: "https://github.com/moshejs/compounded-sofr",
        tags: ["TypeScript"],
        description:
          "SOFR compounding-in-arrears per ARRC/ISDA conventions (lookback, observation shift, lockout) and the SOFR Index method; reproduces the NY Fed's published averages.",
      },
      {
        name: "day-count-conventions",
        url: "https://github.com/moshejs/day-count",
        repo: "https://github.com/moshejs/day-count",
        tags: ["TypeScript"],
        description:
          "ISDA 2006 day-count conventions (30/360 family, ACT/360, ACT/365F, ACT/ACT ISDA and ICMA); zero dependencies.",
      },
      {
        name: "tips-index-ratio",
        url: "https://github.com/moshejs/tips-index-ratio",
        repo: "https://github.com/moshejs/tips-index-ratio",
        tags: ["TypeScript"],
        description:
          "US TIPS inflation math per 31 CFR 356 Appendix B (reference-CPI interpolation, index ratios); reproduces TreasuryDirect's published values.",
      },
      {
        name: "32nds",
        url: "https://github.com/moshejs/32nds",
        repo: "https://github.com/moshejs/32nds",
        tags: ["TypeScript"],
        description:
          "US Treasury price quote math: parse and format 32nds quotes (105-16+), ticks, and basis points; zero dependencies.",
      },
      {
        name: "quantfin",
        url: "https://github.com/boundedvariation/quantfin",
        repo: "https://github.com/boundedvariation/quantfin",
        tags: ["Haskell"],
        description:
          "quant finance in pure haskell.",
      },
      {
        name: "Haxcel",
        url: "https://github.com/MarcusRainbow/Haxcel",
        repo: "https://github.com/MarcusRainbow/Haxcel",
        tags: ["Haskell"],
        description:
          "Excel Addin for Haskell.",
      },
      {
        name: "Ffinar",
        url: "https://github.com/MarcusRainbow/Ffinar",
        repo: "https://github.com/MarcusRainbow/Ffinar",
        tags: ["Haskell"],
        description:
          "A financial maths library in Haskell.",
      },
      {
        name: "QuantScale",
        url: "https://github.com/choucrifahed/quantscale",
        repo: "https://github.com/choucrifahed/quantscale",
        tags: ["Scala"],
        description:
          "Scala Quantitative Finance Library.",
      },
      {
        name: "Scala Quant",
        url: "https://github.com/frankcash/Scala-Quant",
        repo: "https://github.com/frankcash/Scala-Quant",
        tags: ["Scala"],
        description:
          "Scala library for working with stock data from IFTTT recipes or Google Finance.",
      },
      {
        name: "QuantMath",
        url: "https://github.com/MarcusRainbow/QuantMath",
        repo: "https://github.com/MarcusRainbow/QuantMath",
        tags: ["Rust"],
        description:
          "Financial maths library for risk-neutral pricing and risk.",
      },
      {
        name: "RustQuant",
        url: "https://github.com/avhz/RustQuant",
        repo: "https://github.com/avhz/RustQuant",
        tags: ["Rust"],
        description:
          "Quantitative finance library written in Rust.",
      },
      {
        name: "QoX",
        url: "https://github.com/bboutelje/qox-python-samples",
        repo: "https://github.com/bboutelje/qox-python-samples",
        tags: ["Python"],
        description:
          "Finite difference pricing library written in Rust.",
      },
    ],
  },
  {
    name: "Technical Indicators",
    entries: [
      {
        name: "pandas_talib",
        url: "https://github.com/femtotrader/pandas_talib",
        repo: "https://github.com/femtotrader/pandas_talib",
        tags: ["Python"],
        description:
          "A Python Pandas implementation of technical analysis indicators.",
      },
      {
        name: "finta",
        url: "https://github.com/peerchemist/finta",
        repo: "https://github.com/peerchemist/finta",
        tags: ["Python"],
        description:
          "Common financial technical analysis indicators implemented in Pandas.",
      },
      {
        name: "Tulipy",
        url: "https://github.com/cirla/tulipy",
        repo: "https://github.com/cirla/tulipy",
        tags: ["Python"],
        description:
          "Financial Technical Analysis Indicator Library (Python bindings for tulipindicators).",
      },
      {
        name: "lppls",
        url: "https://github.com/Boulder-Investment-Technologies/lppls",
        repo: "https://github.com/Boulder-Investment-Technologies/lppls",
        tags: ["Python"],
        description:
          "A Python module for fitting the Log-Periodic Power Law Singularity (LPPLS) model.",
      },
      {
        name: "talipp",
        url: "https://github.com/nardew/talipp",
        repo: "https://github.com/nardew/talipp",
        tags: ["Python"],
        description:
          "Incremental technical analysis library for Python.",
      },
      {
        name: "streaming_indicators",
        url: "https://github.com/mr-easy/streaming_indicators",
        repo: "https://github.com/mr-easy/streaming_indicators",
        tags: ["Python"],
        description:
          "A python library for computing technical analysis indicators on streaming data.",
      },
      {
        name: "QuantWave",
        url: "https://github.com/lavs9/quantwave",
        repo: "https://github.com/lavs9/quantwave",
        tags: ["Python", "Rust", "Polars"],
        description:
          "Polars-native technical analysis and backtesting with bit-identical batch and streaming parity, plus an agent skill for consistent research-to-live strategy code.",
      },
      {
        name: "TA-Lib",
        url: "https://github.com/mrjbq7/ta-lib",
        repo: "https://github.com/mrjbq7/ta-lib",
        tags: ["Python"],
        description:
          "Python wrapper for TA-Lib (<http://ta-lib.org/>).",
      },
      {
        name: "ta",
        url: "https://github.com/bukosabino/ta",
        repo: "https://github.com/bukosabino/ta",
        tags: ["Python"],
        description:
          "Technical Analysis Library using Pandas (Python).",
      },
      {
        name: "bta-lib",
        url: "https://github.com/mementum/bta-lib",
        repo: "https://github.com/mementum/bta-lib",
        tags: ["Python"],
        description:
          "Technical Analysis library in pandas for backtesting algotrading and quantitative analysis.",
      },
      {
        name: "TuneTA",
        url: "https://github.com/jmrichardson/tuneta",
        repo: "https://github.com/jmrichardson/tuneta",
        tags: ["Python"],
        description:
          "TuneTA optimizes technical indicators using a distance correlation measure to a user defined target feature such as next day return.",
      },
      {
        name: "TTR",
        url: "https://github.com/joshuaulrich/TTR",
        repo: "https://github.com/joshuaulrich/TTR",
        tags: ["R"],
        description:
          "Technical Trading Rules.",
      },
      {
        name: "TALib.jl",
        url: "https://github.com/femtotrader/TALib.jl",
        repo: "https://github.com/femtotrader/TALib.jl",
        tags: ["Julia"],
        description:
          "A Julia wrapper for TA-Lib.",
      },
      {
        name: "Indicators.jl",
        url: "https://github.com/dysonance/Indicators.jl",
        repo: "https://github.com/dysonance/Indicators.jl",
        tags: ["Julia"],
        description:
          "Financial market technical analysis & indicators on top of Temporal.",
      },
      {
        name: "TechnicalIndicatorCharts.jl",
        url: "https://github.com/g-gundam/TechnicalIndicatorCharts.jl",
        repo: "https://github.com/g-gundam/TechnicalIndicatorCharts.jl",
        tags: ["Julia"],
        description:
          "Visualize OnlineTechnicalIndicators.jl using LightweightCharts.jl.",
      },
      {
        name: "MarketTechnicals.jl",
        url: "https://github.com/JuliaQuant/MarketTechnicals.jl",
        repo: "https://github.com/JuliaQuant/MarketTechnicals.jl",
        tags: ["Julia"],
        description:
          "Technical analysis of financial time series on top of TimeSeries.",
      },
      {
        name: "OnlineTechnicalIndicators.jl",
        url: "https://github.com/femtotrader/OnlineTechnicalIndicators.jl",
        repo: "https://github.com/femtotrader/OnlineTechnicalIndicators.jl",
        tags: ["Julia"],
        description:
          "Julia Technical Analysis Indicators via online algorithms.",
      },
      {
        name: "ta4j",
        url: "https://github.com/ta4j/ta4j",
        repo: "https://github.com/ta4j/ta4j",
        tags: ["Java"],
        description:
          "A Java library for technical analysis.",
      },
      {
        name: "IndicatorTS",
        url: "https://github.com/cinar/indicatorts",
        repo: "https://github.com/cinar/indicatorts",
        tags: ["JavaScript"],
        description:
          "Indicator is a TypeScript module providing various stock technical analysis indicators, strategies, and a backtest framework for trading.",
      },
      {
        name: "orderflow",
        url: "https://github.com/focus1691/orderflow",
        repo: "https://github.com/focus1691/orderflow",
        tags: ["JavaScript"],
        description:
          "Orderflow trade aggregator for building Footprint Candles from exchange websocket data.",
      },
      {
        name: "IndicatorGo",
        url: "https://github.com/cinar/indicator",
        repo: "https://github.com/cinar/indicator",
        tags: ["Go"],
        description:
          "IndicatorGo is a Golang module providing various stock technical analysis indicators, strategies, and a backtest framework for trading.",
      },
      {
        name: "TradeAggregation",
        url: "https://github.com/MathisWellmann/trade_aggregation-rs",
        repo: "https://github.com/MathisWellmann/trade_aggregation-rs",
        tags: ["Rust"],
        description:
          "Aggregate trades into user-defined candles using information driven rules.",
      },
      {
        name: "SlidingFeatures",
        url: "https://github.com/MathisWellmann/sliding_features-rs",
        repo: "https://github.com/MathisWellmann/sliding_features-rs",
        tags: ["Rust"],
        description:
          "Chainable tree-like sliding windows for signal processing and technical analysis.",
      },
      {
        name: "fin-primitives",
        url: "https://github.com/Mattbusel/fin-primitives",
        repo: "https://github.com/Mattbusel/fin-primitives",
        tags: ["Rust"],
        description:
          "Financial market primitives in Rust: Price/Quantity/Symbol newtypes, BTreeMap order book, OHLCV aggregation, SMA/EMA/RSI indicators, position ledger with PnL, and composable risk monitor.",
      },
      {
        name: "Wickra",
        url: "https://github.com/wickra-lib/wickra",
        repo: "https://github.com/wickra-lib/wickra",
        tags: ["Rust", "Python", "JavaScript", "C++", "C#", "Go", "Java", "R"],
        description:
          "Streaming-first technical-analysis library with a Rust core: 514 indicators updating in O(1) per tick, with bit-exact batch-vs-streaming results.",
      },
    ],
  },
  {
    name: "Trading & Backtesting",
    entries: [
      {
        name: "midas-core",
        url: "https://github.com/w2ur/midas-core",
        repo: "https://github.com/w2ur/midas-core",
        tags: ["Python"],
        description:
          "Multi-agent paper-trading framework where LLM agents author orders and a separate broker process enforces fifteen fill-time safety rails; each fill is stamped with the git commit it executed against for reproducibility.",
      },
      {
        name: "Manifold-BT",
        url: "https://github.com/manifoldbt/manifoldbt",
        repo: "https://github.com/manifoldbt/manifoldbt",
        tags: ["Python", "Rust"],
        description:
          "High-performance Rust-powered backtesting engine for quantitative research with parameter sweeps, walk-forward and Monte Carlo.",
      },
      {
        name: "mkt-alerts",
        url: "https://github.com/dzianisv/mkt-alerts",
        repo: "https://github.com/dzianisv/mkt-alerts",
        tags: ["TypeScript"],
        description:
          "Self-hosted market-alert daemon: price, RSI/MACD/SMA conditions, and full Pine Script v5 custom indicators evaluated off-TradingView, on crypto (Coinbase) and stocks (Yahoo Finance) with no API key, delivered via ntfy push, email, or Telegram.",
      },
      {
        name: "pyhood",
        url: "https://github.com/jamestford/pyhood",
        repo: "https://github.com/jamestford/pyhood",
        tags: ["Python"],
        description:
          "Robinhood API client for unattended automation: after the first approved login, sessions renew from a stored refresh token with no password or device approval prompt. Covers stocks, equity and index options with Greeks, futures, IRA accounts, and the official Crypto Trading API.",
      },
      {
        name: "honest-signals",
        url: "https://github.com/MarvinRey7879/honest-signals",
        repo: "https://github.com/MarvinRey7879/honest-signals",
        tags: ["Python"],
        description:
          "Scores detected chart patterns against the pattern-free baseline for the same market, timeframe and horizon, reporting lift with cluster-robust confidence intervals instead of a hit rate against 50%.",
      },
      {
        name: "rulelint",
        url: "https://github.com/momoddo/rulelint",
        repo: "https://github.com/momoddo/rulelint",
        tags: ["Python"],
        description:
          "Linter for mechanical trading-rule conditions: replays every condition over historical bars to catch look-ahead levels, dead branches that can never fire, and regime-drifted absolute thresholds before you trust a backtest.",
      },
      {
        name: "FAIG",
        url: "https://github.com/tg12/FAIG",
        repo: "https://github.com/tg12/FAIG",
        tags: ["Python"],
        description:
          "Fully automated trading bot for the IG Index platform (spread betting and CFDs), supporting demo and live accounts.",
      },
      {
        name: "quantify",
        url: "https://github.com/Zhanghanser/quantify",
        repo: "https://github.com/Zhanghanser/quantify",
        tags: ["Python"],
        description:
          "Binance-style trading terminal with multi-strategy backtesting and a real-time, signal-only decision desk for crypto, A-shares, and US stocks.",
      },
      {
        name: "purgedcv",
        url: "https://github.com/eslazarev/purged-cross-validation",
        repo: "https://github.com/eslazarev/purged-cross-validation",
        tags: ["Python"],
        description:
          "scikit-learn-compatible purged, group-purged, and combinatorial purged (CPCV) cross-validation, walk-forward splitting, and backtest-overfitting statistics (deflated and probabilistic Sharpe ratios, PBO, minimum backtest length) to prevent leakage and overfitting when backtesting trading strategies.",
      },
      {
        name: "AlgoVault",
        url: "https://github.com/AlgoVaultLabs/crypto-quant-signal-mcp",
        repo: "https://github.com/AlgoVaultLabs/crypto-quant-signal-mcp",
        tags: ["TypeScript"],
        description:
          "MCP server returning composite crypto trade verdicts (direction, confidence, regime) across 5 perpetual-futures venues, with cross-venue funding-rate arbitrage and an on-chain Merkle-verified track record. Free tier.",
      },
      {
        name: "alpha-forge-mcp",
        url: "https://github.com/alforge-labs/alpha-forge-mcp",
        repo: "https://github.com/alforge-labs/alpha-forge-mcp",
        tags: ["Python"],
        description:
          "MCP server wrapping the AlphaForge CLI for AI-agent-native backtesting, Optuna TPE optimization, and walk-forward testing of trading strategies from Claude Desktop, Cursor, or Claude Code.",
      },
      {
        name: "capitalcom-cli",
        url: "https://github.com/SimonTarara62/capitalcom-cli",
        repo: "https://github.com/SimonTarara62/capitalcom-cli",
        tags: ["Python"],
        description:
          "Unofficial CLI and async SDK for the Capital.com broker API: market data, guarded order execution, and real-time streaming.",
      },
      {
        name: "DepthSight",
        url: "https://github.com/depthsight-pro/depthsight",
        repo: "https://github.com/depthsight-pro/depthsight",
        tags: ["Python", "TypeScript"],
        description:
          "Self-hosted visual algo-trading platform featuring a drag-and-drop strategy builder, an AI co-pilot, and integrated billing.",
      },
      {
        name: "Inalpha",
        url: "https://github.com/mirror29/inalpha",
        repo: "https://github.com/mirror29/inalpha",
        tags: ["Python", "TypeScript"],
        description:
          "Conversational multi-agent quant framework where agents rank currently-effective factors for entry timing (time-series rank IC), write complete strategy code that passes sandboxed audit before backtesting, and evolve strategies under multi-objective fitness; every order requires machine approval and the LLM never has a direct order path.",
      },
      {
        name: "income-desk",
        url: "https://github.com/nitinblue/income-desk",
        repo: "https://github.com/nitinblue/income-desk",
        tags: ["Python"],
        description:
          "Systematic options trading intelligence for small accounts with desk-based portfolio management, pre-trade validation, and multi-broker consolidation.",
      },
      {
        name: "mx-trader-bridge",
        url: "https://github.com/27dream/mx-trader-bridge",
        repo: "https://github.com/27dream/mx-trader-bridge",
        tags: ["Python"],
        description:
          "AI auto-trading bridge for East Money's miaoxiang (妙想) China A-share simulation platform; BYOK multi-LLM (OpenAI/DeepSeek/Moonshot/GLM/Qwen) decision brain → automated order placement via miaoxiang API, with daily cron review and weekly AI reflection.",
      },
      {
        name: "AI Quant Agents",
        url: "https://github.com/demandai/ai-quant-agents",
        repo: "https://github.com/demandai/ai-quant-agents",
        tags: ["Python"],
        description:
          "Multi-agent LLM trading analysis where 12 AI agents (analysts, debaters, risk manager) debate stock picks in real-time, supporting US equities and China A-shares.",
      },
      {
        name: "TradeSight",
        url: "https://github.com/rmbell09-lang/tradesight",
        repo: "https://github.com/rmbell09-lang/tradesight",
        tags: ["Python"],
        description:
          "Self-hosted AI trading platform with strategy evolution, technical analysis, backtesting, and paper trading via Alpaca.",
      },
      {
        name: "Orallexa",
        url: "https://github.com/alex-jb/orallexa-ai-trading-agent",
        repo: "https://github.com/alex-jb/orallexa-ai-trading-agent",
        tags: ["Python"],
        description:
          "AI trading operating system with 9 ML models (RF, XGBoost, EMAformer, MOIRAI-2, Chronos-2, DDPM, PPO RL, GNN, LR) ranked by Sharpe ratio, Claude AI synthesis with dual-tier routing (~$0.003/analysis), real-time Next.js dashboard, Alpaca paper trading, and 277 automated tests.",
      },
      {
        name: "Vibe-Trading",
        url: "https://github.com/HKUDS/Vibe-Trading",
        repo: "https://github.com/HKUDS/Vibe-Trading",
        tags: ["Python"],
        description:
          "Natural-language multi-agent finance research agent with 29 swarm presets, 70 skills, and 28 auto-discovered tools; 7 backtest engines covering A-shares/US/Crypto/Futures/Forex/Options plus a cross-market CompositeEngine with shared capital pool; 5-source auto-fallback data layer (tushare/okx/yfinance/akshare/ccxt); 17-tool MCP server; includes trade-journal behavioral diagnostics for 同花顺/东财/富途 exports.",
      },
      {
        name: "DeepAlpha",
        url: "https://deepalphabot.com",
        repo: "https://github.com/stefanoviana/deepalpha",
        tags: ["Python"],
        description:
          "AI crypto trading bot for Bybit with 70.9% walk-forward validated accuracy on out-of-sample data, LightGBM + XGBoost ensemble with 72 ML features.",
      },
      {
        name: "the0",
        url: "https://github.com/alexanderwanyoike/the0",
        repo: "https://github.com/alexanderwanyoike/the0",
        tags: ["Python"],
        description:
          "Self-hosted execution engine for algorithmic trading bots. Write strategies in Python, TypeScript, Rust, C++, C#, Scala, or Haskell and deploy with one command. Each bot runs in an isolated container with scheduled or streaming execution.",
      },
      {
        name: "autonomous-audit",
        url: "https://pypi.org/project/autonomous-audit/",
        repo: "https://github.com/Autonomous-Asset-Management-Agents/autonomous_/tree/main/packages/autonomous-audit",
        tags: ["Python"],
        description:
          "Tamper-evident SHA-256 hash-chain audit log and human-readable report for AI trading-agent decisions; read-only, offline, and dependency-free (Python standard library only).",
      },
      {
        name: "Investing algorithm framework",
        url: "https://github.com/coding-kitties/investing-algorithm-framework",
        repo: "https://github.com/coding-kitties/investing-algorithm-framework",
        tags: ["Python"],
        description:
          "Framework for developing, backtesting, and deploying automated trading algorithms.",
      },
      {
        name: "Lumibot",
        url: "https://github.com/Lumiwealth/lumibot",
        repo: "https://github.com/Lumiwealth/lumibot",
        tags: ["Python"],
        description:
          "Algorithmic trading framework where the same code runs for backtesting and live trading across stocks, options, crypto, futures, and forex with multiple brokers including Alpaca, Interactive Brokers, Tradier, and Schwab.",
      },
      {
        name: "QSTrader",
        url: "https://github.com/mhallsmoore/qstrader",
        repo: "https://github.com/mhallsmoore/qstrader",
        tags: ["Python"],
        description:
          "QSTrader backtesting simulation engine.",
      },
      {
        name: "Blankly",
        url: "https://github.com/Blankly-Finance/Blankly",
        repo: "https://github.com/Blankly-Finance/Blankly",
        tags: ["Python"],
        description:
          "Fully integrated backtesting, paper trading, and live deployment.",
      },
      {
        name: "zipline",
        url: "https://github.com/quantopian/zipline",
        repo: "https://github.com/quantopian/zipline",
        tags: ["Python"],
        description:
          "Pythonic algorithmic trading library.",
      },
      {
        name: "zipline-reloaded",
        url: "https://github.com/stefan-jansen/zipline-reloaded",
        repo: "https://github.com/stefan-jansen/zipline-reloaded",
        tags: ["Python"],
        description:
          "Zipline, a Pythonic Algorithmic Trading Library.",
      },
      {
        name: "QuantSoftware Toolkit",
        url: "https://github.com/QuantSoftware/QuantSoftwareToolkit",
        repo: "https://github.com/QuantSoftware/QuantSoftwareToolkit",
        tags: ["Python"],
        description:
          "Python-based open source software framework designed to support portfolio construction and management.",
      },
      {
        name: "quantitative",
        url: "https://github.com/jeffrey-liang/quantitative",
        repo: "https://github.com/jeffrey-liang/quantitative",
        tags: ["Python"],
        description:
          "Quantitative finance, and backtesting library.",
      },
      {
        name: "analyzer",
        url: "https://github.com/llazzaro/analyzer",
        repo: "https://github.com/llazzaro/analyzer",
        tags: ["Python"],
        description:
          "Python framework for real-time financial and backtesting trading strategies.",
      },
      {
        name: "bt",
        url: "https://github.com/pmorissette/bt",
        repo: "https://github.com/pmorissette/bt",
        tags: ["Python"],
        description:
          "Flexible Backtesting for Python.",
      },
      {
        name: "backtrader",
        url: "https://github.com/backtrader/backtrader",
        repo: "https://github.com/backtrader/backtrader",
        tags: ["Python"],
        description:
          "Python Backtesting library for trading strategies.",
      },
      {
        name: "backtrader (cloudQuant fork)",
        url: "https://github.com/cloudQuant/backtrader",
        repo: "https://github.com/cloudQuant/backtrader",
        tags: ["Python"],
        description:
          "Actively maintained, high-performance backtesting and live trading framework with AI-assisted strategy tooling (MCP server, skills, agent, web platform). backtrader fork.",
      },
      {
        name: "TrendFollowingSystems",
        url: "https://github.com/ArturSepp/TrendFollowingSystems",
        repo: "https://github.com/ArturSepp/TrendFollowingSystems",
        tags: ["Python"],
        description:
          "Closed-form expected returns, Sharpe ratios, and skewness of trend-following systems, with complete implementations and multi-decade futures backtests.",
      },
      {
        name: "backtest-bias",
        url: "https://github.com/Finance-broski/backtest-bias",
        repo: "https://github.com/Finance-broski/backtest-bias",
        tags: ["Python"],
        description:
          "Checks whether backtest price data is survivor-only: dead-name detection, measured bias benchmarks, CI integrity gates.",
      },
      {
        name: "pythalesians",
        url: "https://github.com/thalesians/pythalesians",
        repo: "https://github.com/thalesians/pythalesians",
        tags: ["Python"],
        description:
          "Python library to backtest trading strategies, plot charts, seamlessly download market data, analyze market patterns etc.",
      },
      {
        name: "pybacktest",
        url: "https://github.com/ematvey/pybacktest",
        repo: "https://github.com/ematvey/pybacktest",
        tags: ["Python"],
        description:
          "Vectorized backtesting framework in Python / pandas, designed to make your backtesting easier.",
      },
      {
        name: "pyalgotrade",
        url: "https://github.com/gbeced/pyalgotrade",
        repo: "https://github.com/gbeced/pyalgotrade",
        tags: ["Python"],
        description:
          "Python Algorithmic Trading Library.",
      },
      {
        name: "basana",
        url: "https://github.com/gbeced/basana",
        repo: "https://github.com/gbeced/basana",
        tags: ["Python"],
        description:
          "A Python async and event driven framework for algorithmic trading, with a focus on crypto currencies.",
      },
      {
        name: "algobroker",
        url: "https://github.com/joequant/algobroker",
        repo: "https://github.com/joequant/algobroker",
        tags: ["Python"],
        description:
          "This is an execution engine for algo trading.",
      },
      {
        name: "finmarketpy",
        url: "https://github.com/cuemacro/finmarketpy",
        repo: "https://github.com/cuemacro/finmarketpy",
        tags: ["Python"],
        description:
          "Python library for backtesting trading strategies and analyzing financial markets.",
      },
      {
        name: "binary-martingale",
        url: "https://github.com/metaperl/binary-martingale",
        repo: "https://github.com/metaperl/binary-martingale",
        tags: ["Python"],
        description:
          "Computer program to automatically trade binary options martingale style.",
      },
      {
        name: "fooltrader",
        url: "https://github.com/foolcage/fooltrader",
        repo: "https://github.com/foolcage/fooltrader",
        tags: ["Python"],
        description:
          "the project using big-data technology to provide an uniform way to analyze the whole market.",
      },
      {
        name: "zvt",
        url: "https://github.com/zvtvz/zvt",
        repo: "https://github.com/zvtvz/zvt",
        tags: ["Python"],
        description:
          "the project using sql, pandas to provide an uniform and extendable way to record data, computing factors, select securities, backtesting, realtime trading and it could show all of them in clearly charts in realtime.",
      },
      {
        name: "pylivetrader",
        url: "https://github.com/alpacahq/pylivetrader",
        repo: "https://github.com/alpacahq/pylivetrader",
        tags: ["Python"],
        description:
          "zipline-compatible live trading library.",
      },
      {
        name: "pipeline-live",
        url: "https://github.com/alpacahq/pipeline-live",
        repo: "https://github.com/alpacahq/pipeline-live",
        tags: ["Python"],
        description:
          "zipline's pipeline capability with IEX for live trading.",
      },
      {
        name: "zipline-extensions",
        url: "https://github.com/quantrocket-llc/zipline-extensions",
        repo: "https://github.com/quantrocket-llc/zipline-extensions",
        tags: ["Python"],
        description:
          "Zipline extensions and adapters for QuantRocket.",
      },
      {
        name: "moonshot",
        url: "https://github.com/quantrocket-llc/moonshot",
        repo: "https://github.com/quantrocket-llc/moonshot",
        tags: ["Python"],
        description:
          "Vectorized backtester and trading engine for QuantRocket based on Pandas.",
      },
      {
        name: "pyqstrat",
        url: "https://github.com/abbass2/pyqstrat",
        repo: "https://github.com/abbass2/pyqstrat",
        tags: ["Python"],
        description:
          "A fast, extensible, transparent python library for backtesting quantitative strategies.",
      },
      {
        name: "NowTrade",
        url: "https://github.com/edouardpoitras/NowTrade",
        repo: "https://github.com/edouardpoitras/NowTrade",
        tags: ["Python"],
        description:
          "Python library for backtesting technical/mechanical strategies in the stock and currency markets.",
      },
      {
        name: "pinkfish",
        url: "https://github.com/fja05680/pinkfish",
        repo: "https://github.com/fja05680/pinkfish",
        tags: ["Python"],
        description:
          "A backtester and spreadsheet library for security analysis.",
      },
      {
        name: "PRISM-INSIGHT",
        url: "https://github.com/dragon1086/prism-insight",
        repo: "https://github.com/dragon1086/prism-insight",
        tags: ["Python"],
        description:
          "AI-powered stock analysis system with 13 specialized agents, automated trading via KIS API, supporting Korean & US markets.",
      },
      {
        name: "FinClaw",
        url: "https://github.com/NeuZhou/finclaw",
        repo: "https://github.com/NeuZhou/finclaw",
        tags: ["Python"],
        description:
          "AI-powered financial intelligence engine with 8 master strategies across US, CN, and HK markets. Multi-agent architecture with +29.1% annual alpha. 227 tests.",
      },
      {
        name: "tw-stock-radar",
        url: "https://github.com/carsonchou/tw-stock-radar",
        repo: "https://github.com/carsonchou/tw-stock-radar",
        tags: ["Python"],
        description:
          "AI-powered Taiwan stock scanner for all 1,900+ TWSE/TPEX listed stocks; chips module (T86 institutional net buy/sell + TDCC 16-tier retail distribution), 13 technical indicators scored 0–100, ATR Chandelier signals with TP1/TP2, dark three.js HUD dashboard. 100% free open data, ~110 unit tests, no API key required.",
      },
      {
        name: "aat",
        url: "https://github.com/timkpaine/aat",
        repo: "https://github.com/timkpaine/aat",
        tags: ["Python"],
        description:
          "Async Algorithmic Trading Engine.",
      },
      {
        name: "Backtesting.py",
        url: "https://kernc.github.io/backtesting.py/",
        tags: ["Python"],
        description:
          "Backtest trading strategies in Python.",
      },
      {
        name: "catalyst",
        url: "https://github.com/enigmampc/catalyst",
        repo: "https://github.com/enigmampc/catalyst",
        tags: ["Python"],
        description:
          "An Algorithmic Trading Library for Crypto-Assets in Python.",
      },
      {
        name: "quantstats",
        url: "https://github.com/ranaroussi/quantstats",
        repo: "https://github.com/ranaroussi/quantstats",
        tags: ["Python"],
        description:
          "Portfolio analytics for quants, written in Python.",
      },
      {
        name: "jquantstats",
        url: "https://github.com/Jebel-Quant/jquantstats",
        repo: "https://github.com/Jebel-Quant/jquantstats",
        tags: ["Python"],
        description:
          "Modern variation of quantstats, with additional features and performance improvements.",
      },
      {
        name: "qtpylib",
        url: "https://github.com/ranaroussi/qtpylib",
        repo: "https://github.com/ranaroussi/qtpylib",
        tags: ["Python"],
        description:
          "QTPyLib, Pythonic Algorithmic Trading <http://qtpylib.io>.",
      },
      {
        name: "Quantdom",
        url: "https://github.com/constverum/Quantdom",
        repo: "https://github.com/constverum/Quantdom",
        tags: ["Python"],
        description:
          "Python-based framework for backtesting trading strategies & analyzing financial markets [GUI :neckbeard:.]",
      },
      {
        name: "freqtrade",
        url: "https://github.com/freqtrade/freqtrade",
        repo: "https://github.com/freqtrade/freqtrade",
        tags: ["Python"],
        description:
          "Free, open source crypto trading bot.",
      },
      {
        name: "algorithmic-trading-with-python",
        url: "https://github.com/chrisconlan/algorithmic-trading-with-python",
        repo: "https://github.com/chrisconlan/algorithmic-trading-with-python",
        tags: ["Python"],
        description:
          "Free `pandas` and `scikit-learn` resources for trading simulation, backtesting, and machine learning on financial data.",
      },
      {
        name: "Qlib",
        url: "https://github.com/microsoft/qlib",
        repo: "https://github.com/microsoft/qlib",
        tags: ["Python"],
        description:
          "An AI-oriented Quantitative Investment Platform by Microsoft. Full ML pipeline of data processing, model training, back-testing; and covers the entire chain of quantitative investment: alpha seeking, risk modeling, portfolio optimization, and order execution.",
      },
      {
        name: "finlab",
        url: "https://pypi.org/project/finlab/",
        tags: ["Python"],
        description:
          "Python package for Taiwan stock market data, factor research, and vectorized backtesting with pandas-style strategy definitions.",
      },
      {
        name: "machine-learning-for-trading",
        url: "https://github.com/stefan-jansen/machine-learning-for-trading",
        repo: "https://github.com/stefan-jansen/machine-learning-for-trading",
        tags: ["Python"],
        description:
          "Code and resources for Machine Learning for Algorithmic Trading.",
      },
      {
        name: "AlphaPy",
        url: "https://github.com/ScottfreeLLC/AlphaPy",
        repo: "https://github.com/ScottfreeLLC/AlphaPy",
        tags: ["Python"],
        description:
          "Automated Machine Learning [AutoML] with Python, scikit-learn, Keras, XGBoost, LightGBM, and CatBoost.",
      },
      {
        name: "jesse",
        url: "https://github.com/jesse-ai/jesse",
        repo: "https://github.com/jesse-ai/jesse",
        tags: ["Python"],
        description:
          "An advanced crypto trading bot written in Python.",
      },
      {
        name: "rqalpha",
        url: "https://github.com/ricequant/rqalpha",
        repo: "https://github.com/ricequant/rqalpha",
        tags: ["Python"],
        description:
          "A extendable, replaceable Python algorithmic backtest && trading framework supporting multiple securities.",
      },
      {
        name: "FinRL-Library",
        url: "https://github.com/AI4Finance-LLC/FinRL-Library",
        repo: "https://github.com/AI4Finance-LLC/FinRL-Library",
        tags: ["Python"],
        description:
          "A Deep Reinforcement Learning Library for Automated Trading in Quantitative Finance. NeurIPS 2020.",
      },
      {
        name: "aurumq-rl",
        url: "https://github.com/yupoet/aurumq-rl",
        repo: "https://github.com/yupoet/aurumq-rl",
        tags: ["Python"],
        description:
          "Reinforcement learning stock-selection framework for the China A-share market with multi-source factor input (alpha101 + main-force flow + hot-money seats + northbound + institutional + fundamentals), board-aware price limits, and ONNX CPU inference.",
      },
      {
        name: "bulbea",
        url: "https://github.com/achillesrasquinha/bulbea",
        repo: "https://github.com/achillesrasquinha/bulbea",
        tags: ["Python"],
        description:
          "Deep Learning based Python Library for Stock Market Prediction and Modelling.",
      },
      {
        name: "ib_nope",
        url: "https://github.com/ajhpark/ib_nope",
        repo: "https://github.com/ajhpark/ib_nope",
        tags: ["Python"],
        description:
          "Automated trading system for NOPE strategy over IBKR TWS.",
      },
      {
        name: "OctoBot",
        url: "https://github.com/Drakkar-Software/OctoBot",
        repo: "https://github.com/Drakkar-Software/OctoBot",
        tags: ["Python"],
        description:
          "Open source cryptocurrency trading bot for high frequency, arbitrage, TA and social trading with an advanced web interface.",
      },
      {
        name: "Stock-Prediction-Models",
        url: "https://github.com/huseinzol05/Stock-Prediction-Models",
        repo: "https://github.com/huseinzol05/Stock-Prediction-Models",
        tags: ["Python"],
        description:
          "Gathers machine learning and deep learning models for Stock forecasting including trading bots and simulations.",
      },
      {
        name: "AutoTrader",
        url: "https://github.com/kieran-mackle/AutoTrader",
        repo: "https://github.com/kieran-mackle/AutoTrader",
        tags: ["Python"],
        description:
          "A Python-based development platform for automated trading systems - from backtesting to optimization to livetrading.",
      },
      {
        name: "fast-trade",
        url: "https://github.com/jrmeier/fast-trade",
        repo: "https://github.com/jrmeier/fast-trade",
        tags: ["Python"],
        description:
          "A library built with backtest portability and performance in mind for backtest trading strategies.",
      },
      {
        name: "qf-lib",
        url: "https://github.com/quarkfin/qf-lib",
        repo: "https://github.com/quarkfin/qf-lib",
        tags: ["Python"],
        description:
          "QF-Lib is a Python library that provides high quality tools for quantitative finance.",
      },
      {
        name: "tda-api",
        url: "https://github.com/alexgolec/tda-api",
        repo: "https://github.com/alexgolec/tda-api",
        tags: ["Python"],
        description:
          "Gather data and trade equities, options, and ETFs via TDAmeritrade.",
      },
      {
        name: "vectorbt",
        url: "https://github.com/polakowo/vectorbt",
        repo: "https://github.com/polakowo/vectorbt",
        tags: ["Python"],
        description:
          "Find your trading edge, using a powerful toolkit for backtesting, algorithmic trading, and research.",
      },
      {
        name: "Lean",
        url: "https://github.com/QuantConnect/Lean",
        repo: "https://github.com/QuantConnect/Lean",
        tags: ["Python", "C#"],
        description:
          "Lean Algorithmic Trading Engine by QuantConnect (Python, C#).",
      },
      {
        name: "pysystemtrade",
        url: "https://github.com/robcarver17/pysystemtrade",
        repo: "https://github.com/robcarver17/pysystemtrade",
        tags: ["Python"],
        description:
          "pysystemtrade is the open source version of Robert Carver's backtesting and trading engine that implements systems according to the framework outlined in his book \"Systematic Trading\", which is further developed on his blog.",
      },
      {
        name: "pytrendseries",
        url: "https://github.com/rafa-rod/pytrendseries",
        repo: "https://github.com/rafa-rod/pytrendseries",
        tags: ["Python"],
        description:
          "Detect trend in time series, drawdown, drawdown within a constant look-back window , maximum drawdown, time underwater.",
      },
      {
        name: "PyLOB",
        url: "https://github.com/DrAshBooth/PyLOB",
        repo: "https://github.com/DrAshBooth/PyLOB",
        tags: ["Python"],
        description:
          "Fully functioning fast Limit Order Book written in Python.",
      },
      {
        name: "PyBroker",
        url: "https://github.com/edtechre/pybroker",
        repo: "https://github.com/edtechre/pybroker",
        tags: ["Python"],
        description:
          "Algorithmic Trading with Machine Learning.",
      },
      {
        name: "OctoBot Script",
        url: "https://github.com/Drakkar-Software/OctoBot-Script",
        repo: "https://github.com/Drakkar-Software/OctoBot-Script",
        tags: ["Python"],
        description:
          "A quant framework to create cryptocurrencies strategies - from backtesting to optimization to livetrading.",
      },
      {
        name: "hftbacktest",
        url: "https://github.com/nkaz001/hftbacktest",
        repo: "https://github.com/nkaz001/hftbacktest",
        tags: ["Python"],
        description:
          "A high-frequency trading and market-making backtesting tool accounts for limit orders, queue positions, and latencies, utilizing full tick data for trades and order books.",
      },
      {
        name: "flashalpha-fill-simulator",
        url: "https://github.com/FlashAlpha-lab/flashalpha-fill-simulator",
        repo: "https://github.com/FlashAlpha-lab/flashalpha-fill-simulator",
        tags: ["Python"],
        description:
          "Realistic limit-order fill simulator for options credit/debit spreads with post-and-wait limits, stale-quote guards, deterministic same-bar tiebreaks, and a patient-then-cross exit; engine-agnostic and zero runtime dependencies.",
      },
      {
        name: "vnpy",
        url: "https://github.com/vnpy/vnpy",
        repo: "https://github.com/vnpy/vnpy",
        tags: ["Python"],
        description:
          "VeighNa is a Python-based open source quantitative trading system development framework.",
      },
      {
        name: "Intelligent Trading Bot",
        url: "https://github.com/asavinov/intelligent-trading-bot",
        repo: "https://github.com/asavinov/intelligent-trading-bot",
        tags: ["Python"],
        description:
          "Automatically generating signals and trading based on machine learning and feature engineering.",
      },
      {
        name: "fastquant",
        url: "https://github.com/enzoampil/fastquant",
        repo: "https://github.com/enzoampil/fastquant",
        tags: ["Python"],
        description:
          "fastquant allows you to easily backtest investment strategies with as few as 3 lines of python code.",
      },
      {
        name: "nautilus_trader",
        url: "https://github.com/nautechsystems/nautilus_trader",
        repo: "https://github.com/nautechsystems/nautilus_trader",
        tags: ["Python", "Rust"],
        description:
          "A high-performance algorithmic trading platform and event-driven backtester.",
      },
      {
        name: "NoEdge-Bench",
        url: "https://github.com/nexusfinancial-dev/noedge-bench",
        repo: "https://github.com/nexusfinancial-dev/noedge-bench",
        tags: ["Python"],
        description:
          "Reproducible negative-result benchmark: no model beats a memoryless synthetic binary-options feed (AUC ≈ 0.50), with permutation-null tests and a look-ahead-leak case study.",
      },
      {
        name: "YABTE",
        url: "https://github.com/bsdz/yabte",
        repo: "https://github.com/bsdz/yabte",
        tags: ["Python"],
        description:
          "Yet Another (Python) BackTesting Engine.",
      },
      {
        name: "Trading Strategy",
        url: "https://github.com/tradingstrategy-ai/getting-started",
        repo: "https://github.com/tradingstrategy-ai/getting-started",
        tags: ["Python"],
        description:
          "TradingStrategy.ai is a market data, backtesting, live trading and investor management framework for decentralised finance.",
      },
      {
        name: "Hikyuu",
        url: "https://github.com/fasiondog/hikyuu",
        repo: "https://github.com/fasiondog/hikyuu",
        tags: ["Python", "C++"],
        description:
          "A base on Python/C++ open source high-performance quant framework for faster analysis and backtesting, contains the complete trading system components for reuse and combination.",
      },
      {
        name: "rust_bt",
        url: "https://github.com/jensnesten/rust_bt",
        repo: "https://github.com/jensnesten/rust_bt",
        tags: ["Python"],
        description:
          "A high performance, low-latency backtesting engine for testing quantitative trading strategies on historical and live data in Rust.",
      },
      {
        name: "Gunbot Quant",
        url: "https://github.com/GuntharDeNiro/gunbot-quant",
        repo: "https://github.com/GuntharDeNiro/gunbot-quant",
        tags: ["Python"],
        description:
          "Toolkit for quantitative trading analysis. It integrates an advanced market screener, a multi-strategy, multi-asset backtesting engine. Use with built-in GUI or through CLI.",
      },
      {
        name: "StrateQueue",
        url: "https://github.com/StrateQueue/StrateQueue",
        repo: "https://github.com/StrateQueue/StrateQueue",
        tags: ["Python"],
        description:
          "An open‑source, broker‑agnostic Python library that lets you seamlessly deploy strategies from any major backtesting engine to live (or paper) trading with zero code changes and built‑in safety controls.",
      },
      {
        name: "PythonTradingFramework",
        url: "https://github.com/JustinGuese/python_tradingbot_framework",
        repo: "https://github.com/JustinGuese/python_tradingbot_framework",
        tags: ["Python"],
        description:
          "Python algorithmic trading bot framework for Kubernetes: backtesting, hyperparameter optimization, 150+ technical analysis indicators (RSI, MACD, Bollinger Bands, ADX), portfolio management, PostgreSQL integration, Helm deployment, CronJob scheduling. Minimal overhead, production-ready, Yahoo Finance data.",
      },
      {
        name: "QTradeX-AI-Agents",
        url: "https://github.com/squidKid-deluxe/QTradeX-AI-Agents",
        repo: "https://github.com/squidKid-deluxe/QTradeX-AI-Agents",
        tags: ["Python"],
        description:
          "Example strategies for the QTradeX platfrom.",
      },
      {
        name: "QTradeX-Algo-Trading-SDK",
        url: "https://github.com/squidKid-deluxe/QTradeX-Algo-Trading-SDK",
        repo: "https://github.com/squidKid-deluxe/QTradeX-Algo-Trading-SDK",
        tags: ["Python"],
        description:
          "AI-powered SDK featuring algorithmic trading, backtesting, deployment on 100+ exchanges, and multiple optimization engines.",
      },
      {
        name: "antback",
        url: "https://github.com/ts-kontakt/antback",
        repo: "https://github.com/ts-kontakt/antback",
        tags: ["Python"],
        description:
          "A lightweight, event-loop-style backtest engine that allows a function-driven imperative style using efficient stateful helper functions and data containers.",
      },
      {
        name: "VARRD",
        url: "https://github.com/augiemazza/varrd",
        repo: "https://github.com/augiemazza/varrd",
        tags: ["Python"],
        description:
          "AI-powered trading edge discovery platform that validates trading ideas with event studies, statistical tests, and real market data. Web app, MCP server, CLI (`pip install varrd`), and Python SDK.",
      },
      {
        name: "JIT-Optimization-Engine",
        url: "https://github.com/cloudsealed/JIT-Optimization-Engine",
        repo: "https://github.com/cloudsealed/JIT-Optimization-Engine",
        tags: ["Python"],
        description:
          "High-performance analytical core using LLVM JIT (Numba) to process large-scale telemetry for quant diagnostics.",
      },
      {
        name: "backtester-mcp",
        url: "https://pypi.org/project/backtester-mcp/",
        repo: "https://github.com/bcosm/backtester-mcp",
        tags: ["Python"],
        description:
          "Local-first backtesting engine with built-in overfitting checks (PBO, deflated Sharpe, bootstrap CI, walk-forward) and a native MCP server for AI agents.",
      },
      {
        name: "backtest",
        url: "https://cran.r-project.org/web/packages/backtest/index.html",
        tags: ["R"],
        description:
          "Exploring Portfolio-Based Conjectures About Financial Instruments.",
      },
      {
        name: "pa",
        url: "https://cran.r-project.org/web/packages/pa/index.html",
        tags: ["R"],
        description:
          "Performance Attribution for Equity Portfolios.",
      },
      {
        name: "QuantTools",
        url: "https://quanttools.bitbucket.io/_site/index.html",
        tags: ["R"],
        description:
          "Enhanced Quantitative Trading Modelling.",
      },
      {
        name: "blotter",
        url: "https://github.com/braverock/blotter",
        repo: "https://github.com/braverock/blotter",
        tags: ["R"],
        description:
          "Transaction infrastructure for defining instruments, transactions, portfolios and accounts for trading systems and simulation. Provides portfolio support for multi-asset class and multi-currency portfolios. Actively maintained and developed.",
      },
      {
        name: "quantstrat",
        url: "https://github.com/braverock/quantstrat",
        repo: "https://github.com/braverock/quantstrat",
        tags: ["R"],
        description:
          "Transaction-oriented infrastructure for constructing trading systems and simulation. Provides support for multi-asset class and multi-currency portfolios for backtesting and other financial research.",
      },
      {
        name: "QUANTAXIS",
        url: "https://github.com/yutiansut/quantaxis",
        repo: "https://github.com/yutiansut/quantaxis",
        tags: ["Matlab"],
        description:
          "Integrated Quantitative Toolbox with Matlab.",
      },
      {
        name: "PROJ_Option_Pricing_Matlab",
        url: "https://github.com/jkirkby3/PROJ_Option_Pricing_Matlab",
        repo: "https://github.com/jkirkby3/PROJ_Option_Pricing_Matlab",
        tags: ["Matlab"],
        description:
          "Quant Option Pricing - Exotic/Vanilla: Barrier, Asian, European, American, Parisian, Lookback, Cliquet, Variance Swap, Swing, Forward Starting, Step, Fader.",
      },
      {
        name: "Fastback.jl",
        url: "https://github.com/rbeeli/Fastback.jl",
        repo: "https://github.com/rbeeli/Fastback.jl",
        tags: ["Julia"],
        description:
          "Blazing fast Julia backtester.",
      },
      {
        name: "Lucky.jl",
        url: "https://github.com/oliviermilla/Lucky.jl",
        repo: "https://github.com/oliviermilla/Lucky.jl",
        tags: ["Julia"],
        description:
          "Modular, asynchronous trading engine in pure Julia.",
      },
      {
        name: "Strategems.jl",
        url: "https://github.com/dysonance/Strategems.jl",
        repo: "https://github.com/dysonance/Strategems.jl",
        tags: ["Julia"],
        description:
          "Quantitative systematic trading strategy development and backtesting.",
      },
      {
        name: "ccxt",
        url: "https://github.com/ccxt/ccxt",
        repo: "https://github.com/ccxt/ccxt",
        tags: ["JavaScript", "Python", "PHP"],
        description:
          "A JavaScript / Python / PHP cryptocurrency trading API with support for more than 100 bitcoin/altcoin exchanges.",
      },
      {
        name: "binance-fix-connector-python",
        url: "https://github.com/AlexanderMerkel/binance-fix-connector-python",
        repo: "https://github.com/AlexanderMerkel/binance-fix-connector-python",
        tags: ["Python"],
        description:
          "Async Python connector for Binance Spot FIX sessions with Order Entry, Market Data, and Drop Copy support.",
      },
      {
        name: "Jiji",
        url: "https://github.com/unageanu/jiji2",
        repo: "https://github.com/unageanu/jiji2",
        tags: ["Ruby"],
        description:
          "Open Source Forex algorithmic trading framework using OANDA REST API.",
      },
      {
        name: "Tai",
        url: "https://github.com/fremantle-capital/tai",
        repo: "https://github.com/fremantle-capital/tai",
        tags: ["Elixir"],
        description:
          "Open Source composable, real time, market data and trade execution toolkit.",
      },
      {
        name: "Workbench",
        url: "https://github.com/fremantle-industries/workbench",
        repo: "https://github.com/fremantle-industries/workbench",
        tags: ["Elixir"],
        description:
          "From Idea to Execution - Manage your trading operation across a globally distributed cluster.",
      },
      {
        name: "Prop",
        url: "https://github.com/fremantle-industries/prop",
        repo: "https://github.com/fremantle-industries/prop",
        tags: ["Elixir"],
        description:
          "An open and opinionated trading platform using productive & familiar open source libraries and tools for strategy research, execution and operation.",
      },
      {
        name: "Kelp",
        url: "https://github.com/stellar/kelp",
        repo: "https://github.com/stellar/kelp",
        tags: ["Go"],
        description:
          "Kelp is an open-source Golang algorithmic cryptocurrency trading bot that runs on centralized exchanges and Stellar DEX (command-line usage and desktop GUI).",
      },
      {
        name: "TradeFrame",
        url: "https://github.com/rburkholder/trade-frame",
        repo: "https://github.com/rburkholder/trade-frame",
        tags: ["C++"],
        description:
          "C++ 17 based framework/library (with sample applications) for testing options based automated trading ideas using DTN IQ real time data feed and Interactive Brokers (TWS API) for trade execution. Comes with built-in Option Greeks/IV calculation library.",
      },
      {
        name: "Hikyuu",
        url: "https://github.com/fasiondog/hikyuu",
        repo: "https://github.com/fasiondog/hikyuu",
        tags: ["Python", "C++"],
        description:
          "A base on Python/C++ open source high-performance quant framework for faster analysis and backtesting, contains the complete trading system components for reuse and combination. You can use python or c++ freely.",
      },
      {
        name: "OrderMatchingEngine",
        url: "https://github.com/PIYUSH-KUMAR1809/order-matching-engine",
        repo: "https://github.com/PIYUSH-KUMAR1809/order-matching-engine",
        tags: ["C++"],
        description:
          "A production-grade, lock-free, high-frequency trading matching engine achieving 150M+ orders/sec.",
      },
      {
        name: "PandoraTrader",
        url: "https://github.com/pegasusTrader/PandoraTrader",
        repo: "https://github.com/pegasusTrader/PandoraTrader",
        tags: ["C++"],
        description:
          "A C++ CTP trading framework, with very clear logic.",
      },
      {
        name: "NexusFix",
        url: "https://github.com/SilverstreamsAI/NexusFix",
        repo: "https://github.com/SilverstreamsAI/NexusFix",
        tags: ["C++"],
        description:
          "C++23 FIX protocol engine with zero-copy parsing and SIMD acceleration, 3x faster than QuickFIX.",
      },
      {
        name: "TolmachЁv Netcode SDK",
        url: "https://github.com/billionerleha-111/Tolmachev-Netcode-SDK",
        repo: "https://github.com/billionerleha-111/Tolmachev-Netcode-SDK",
        tags: ["C++"],
        description:
          "Enterprise-grade deterministic state synchronization engine for MFT gateways and statistical arbitrage. Eliminates microsecond deltas locking order books via topological mathematics. Throughput >41.5M TPS, physical RTT 24.175 ns, atomic validation (0 CPU load). Website",
      },
      {
        name: "QuantConnect",
        url: "https://github.com/QuantConnect/Lean",
        repo: "https://github.com/QuantConnect/Lean",
        tags: ["C#"],
        description:
          "Lean Engine is an open-source fully managed C# algorithmic trading engine built for desktop and cloud usage.",
      },
      {
        name: "StockSharp",
        url: "https://github.com/StockSharp/StockSharp",
        repo: "https://github.com/StockSharp/StockSharp",
        tags: ["C#"],
        description:
          "Algorithmic trading and quantitative trading open source platform to develop trading robots (stock markets, forex, crypto, bitcoins, and options).",
      },
      {
        name: "TDAmeritrade.DotNetCore",
        url: "https://github.com/NVentimiglia/TDAmeritrade.DotNetCore",
        repo: "https://github.com/NVentimiglia/TDAmeritrade.DotNetCore",
        tags: ["C#"],
        description:
          "Free, open-source .NET Client for the TD Ameritrade Trading Platform. Helps developers integrate TD Ameritrade API into custom trading solutions.",
      },
      {
        name: "Barter",
        url: "https://github.com/barter-rs/barter-rs",
        repo: "https://github.com/barter-rs/barter-rs",
        tags: ["Rust"],
        description:
          "Open-source Rust framework for building event-driven live-trading & backtesting systems.",
      },
      {
        name: "LFEST",
        url: "https://github.com/MathisWellmann/lfest-rs",
        repo: "https://github.com/MathisWellmann/lfest-rs",
        tags: ["Rust"],
        description:
          "Simulated perpetual futures exchange to trade your strategy against.",
      },
      {
        name: "Sextant",
        url: "https://github.com/raphaub-hub/SEXTANT",
        repo: "https://github.com/raphaub-hub/SEXTANT",
        tags: ["Python"],
        description:
          "Local event-driven backtesting engine with no-code strategy builder and FRED vintage, ALFRED, yFinance support.",
      },
      {
        name: "TradeClaw",
        url: "https://github.com/naimkatiman/tradeclaw",
        repo: "https://github.com/naimkatiman/tradeclaw",
        tags: ["JavaScript", "TypeScript"],
        description:
          "Open-source self-hosted AI trading signal platform. Generates buy/sell signals using RSI, MACD, EMA, Bollinger Bands for forex, crypto and commodities. Deployable via Docker Compose. (Demo)",
      },
      {
        name: "ShowMe",
        url: "https://github.com/nazmiefearmutcu/showMe",
        repo: "https://github.com/nazmiefearmutcu/showMe",
        tags: ["Python", "Rust", "TypeScript"],
        description:
          "Open-source native macOS market cockpit. 12-timeframe consensus scan across 3370 symbols (crypto + equity + ETF + FX + commodity + bond), 23 technical indicators with per-market calibration, real WebSocket streaming. Tauri shell + Python sidecar (FastAPI) + React UI; 110+ exchanges via ccxt.",
      },
      {
        name: "TBV1",
        url: "https://github.com/nazmiefearmutcu/TRADING-BOT",
        repo: "https://github.com/nazmiefearmutcu/TRADING-BOT",
        tags: ["Python"],
        description:
          "Crypto perpetual-futures bot with a 7-tab web dashboard and a 15-indicator consensus engine voting across 12 timeframes (1m → 1d). Paper-mode by default. Includes packaged macOS reference build and Windows distribution.",
      },
      {
        name: "TraderHarness",
        url: "https://github.com/HephaestLab/TraderHarness",
        repo: "https://github.com/HephaestLab/TraderHarness",
        tags: ["Python"],
        description:
          "Contamination-resistant A-share backtesting environment for LLM trading agents with point-in-time masking, entity/date anonymization, fingerprinted replay, and trajectory (SFT) export.",
      },
      {
        name: "VerumTrade",
        url: "https://github.com/muye1202/VerumTrade",
        repo: "https://github.com/muye1202/VerumTrade",
        tags: ["Python"],
        description:
          "A reasoning & decision-trace visible Multi-agent LLM trading-research framework where bull/bear analysts debate each ticker and every decision cites the evidence it rests on.",
      },
    ],
  },
  {
    name: "Portfolio Optimization & Risk Analysis",
    entries: [
      {
        name: "Multi-Axis Robust Portfolio Optimization",
        url: "https://github.com/Viraj-Nigwekar/multi-axis-robust-portfolio-optimization",
        repo: "https://github.com/Viraj-Nigwekar/multi-axis-robust-portfolio-optimization",
        tags: ["Python"],
        description:
          "Portfolio optimization framework combining covariance shrinkage, bootstrap aggregation, and parametric scenario modeling, with reproducible notebooks and an accompanying SSRN paper.",
      },
      {
        name: "AutoHypothesis",
        url: "https://github.com/arteemg/AutoHypothesis",
        repo: "https://github.com/arteemg/AutoHypothesis",
        tags: ["Python"],
        description:
          "An agentic framework that mimics the real quant trading pipeline to find alpha: economic hypothesis, in-sample iteration, and out-of-sample validation.",
      },
      {
        name: "skfolio",
        url: "https://github.com/skfolio/skfolio",
        repo: "https://github.com/skfolio/skfolio",
        tags: ["Python"],
        description:
          "Python library for portfolio optimization built on top of scikit-learn. It provides a unified interface and sklearn compatible tools to build, tune and cross-validate portfolio models.",
      },
      {
        name: "PyPortfolioOpt",
        url: "https://github.com/robertmartin8/PyPortfolioOpt",
        repo: "https://github.com/robertmartin8/PyPortfolioOpt",
        tags: ["Python"],
        description:
          "Financial portfolio optimization in python, including classical efficient frontier and advanced methods.",
      },
      {
        name: "factorlasso",
        url: "https://github.com/ArturSepp/factorlasso",
        repo: "https://github.com/ArturSepp/factorlasso",
        tags: ["Python"],
        description:
          "Sparse multi-asset factor models with cell-level sign constraints, prior-centred shrinkage, and hierarchical clustering group LASSO (HCGL); scikit-learn compatible.",
      },
      {
        name: "OptimalPortfolios",
        url: "https://github.com/ArturSepp/OptimalPortfolios",
        repo: "https://github.com/ArturSepp/OptimalPortfolios",
        tags: ["Python"],
        description:
          "Optimisation analytics for constructing and backtesting optimal multi-asset portfolios: covariance estimation, rolling optimisation, and performance reporting in one pipeline.",
      },
      {
        name: "Eiten",
        url: "https://github.com/tradytics/eiten",
        repo: "https://github.com/tradytics/eiten",
        tags: ["Python"],
        description:
          "Eiten is an open source toolkit by Tradytics that implements various statistical and algorithmic investing strategies such as Eigen Portfolios, Minimum Variance Portfolios, Maximum Sharpe Ratio Portfolios, and Genetic Algorithms based Portfolios.",
      },
      {
        name: "riskparity.py",
        url: "https://github.com/dppalomar/riskparity.py",
        repo: "https://github.com/dppalomar/riskparity.py",
        tags: ["Python"],
        description:
          "fast and scalable design of risk parity portfolios with TensorFlow 2.0.",
      },
      {
        name: "mlfinlab",
        url: "https://github.com/hudson-and-thames/mlfinlab",
        repo: "https://github.com/hudson-and-thames/mlfinlab",
        tags: ["Python"],
        description:
          "Implementations regarding \"Advances in Financial Machine Learning\" by Marcos Lopez de Prado. (Feature Engineering, Financial Data Structures, Meta-Labeling).",
      },
      {
        name: "DeepDow",
        url: "https://github.com/jankrepl/deepdow",
        repo: "https://github.com/jankrepl/deepdow",
        tags: ["Python"],
        description:
          "Portfolio optimization with deep learning.",
      },
      {
        name: "goal-based-allocation",
        url: "https://github.com/ArturSepp/GoalBasedAllocation",
        repo: "https://github.com/ArturSepp/GoalBasedAllocation",
        tags: ["Python"],
        description:
          "Dynamic mean-variance portfolio allocation under regime-switching jump-diffusions with wealth floors, solved analytically via Laplace transforms.",
      },
      {
        name: "QuantLibRisks",
        url: "https://github.com/auto-differentiation/QuantLib-Risks-Py",
        repo: "https://github.com/auto-differentiation/QuantLib-Risks-Py",
        tags: ["Python"],
        description:
          "Fast risks with QuantLib.",
      },
      {
        name: "XAD",
        url: "https://github.com/auto-differentiation/xad-py",
        repo: "https://github.com/auto-differentiation/xad-py",
        tags: ["Python"],
        description:
          "Automatic Differentation (AAD) Library.",
      },
      {
        name: "pyfolio",
        url: "https://github.com/quantopian/pyfolio",
        repo: "https://github.com/quantopian/pyfolio",
        tags: ["Python"],
        description:
          "Portfolio and risk analytics in Python.",
      },
      {
        name: "etfray",
        url: "https://github.com/alwank/etfray",
        repo: "https://github.com/alwank/etfray",
        tags: ["Python"],
        description:
          "Terminal-based ETF research and portfolio analytics application for holdings, exposure, concentration, margin, and risk workflows.",
      },
      {
        name: "empyrical",
        url: "https://github.com/quantopian/empyrical",
        repo: "https://github.com/quantopian/empyrical",
        tags: ["Python"],
        description:
          "Common financial risk and performance metrics.",
      },
      {
        name: "fecon235",
        url: "https://github.com/rsvp/fecon235",
        repo: "https://github.com/rsvp/fecon235",
        tags: ["Python"],
        description:
          "Computational tools for financial economics include: Gaussian Mixture model of leptokurtotic risk, adaptive Boltzmann portfolios.",
      },
      {
        name: "finance",
        url: "https://pypi.org/project/finance/",
        tags: ["Python"],
        description:
          "Financial Risk Calculations. Optimized for ease of use through class construction and operator overload.",
      },
      {
        name: "qfrm",
        url: "https://pypi.org/project/qfrm/",
        tags: ["Python"],
        description:
          "Quantitative Financial Risk Management: awesome OOP tools for measuring, managing and visualizing risk of financial instruments and portfolios. (Last updated: 2015-12-12).",
      },
      {
        name: "visualize-wealth",
        url: "https://github.com/benjaminmgross/visualize-wealth",
        repo: "https://github.com/benjaminmgross/visualize-wealth",
        tags: ["Python"],
        description:
          "Portfolio construction and quantitative analysis.",
      },
      {
        name: "VisualPortfolio",
        url: "https://github.com/wegamekinglc/VisualPortfolio",
        repo: "https://github.com/wegamekinglc/VisualPortfolio",
        tags: ["Python"],
        description:
          "This tool is used to visualize the performance of a portfolio.",
      },
      {
        name: "universal-portfolios",
        url: "https://github.com/Marigold/universal-portfolios",
        repo: "https://github.com/Marigold/universal-portfolios",
        tags: ["Python"],
        description:
          "Collection of algorithms for online portfolio selection.",
      },
      {
        name: "FinQuant",
        url: "https://github.com/fmilthaler/FinQuant",
        repo: "https://github.com/fmilthaler/FinQuant",
        tags: ["Python"],
        description:
          "A program for financial portfolio management, analysis and optimization.",
      },
      {
        name: "Empyrial",
        url: "https://github.com/ssantoshp/Empyrial",
        repo: "https://github.com/ssantoshp/Empyrial",
        tags: ["Python"],
        description:
          "Portfolio's risk and performance analytics and returns predictions.",
      },
      {
        name: "risktools",
        url: "https://github.com/bbcho/risktools-dev",
        repo: "https://github.com/bbcho/risktools-dev",
        tags: ["Python"],
        description:
          "Risk tools for use within the crude and crude products trading space with partial implementation of R's PerformanceAnalytics.",
      },
      {
        name: "Riskfolio-Lib",
        url: "https://github.com/dcajasn/Riskfolio-Lib",
        repo: "https://github.com/dcajasn/Riskfolio-Lib",
        tags: ["Python"],
        description:
          "Portfolio Optimization and Quantitative Strategic Asset Allocation in Python.",
      },
      {
        name: "empyrical-reloaded",
        url: "https://github.com/stefan-jansen/empyrical-reloaded",
        repo: "https://github.com/stefan-jansen/empyrical-reloaded",
        tags: ["Python"],
        description:
          "Common financial risk and performance metrics. empyrical fork.",
      },
      {
        name: "pyfolio-reloaded",
        url: "https://github.com/stefan-jansen/pyfolio-reloaded",
        repo: "https://github.com/stefan-jansen/pyfolio-reloaded",
        tags: ["Python"],
        description:
          "Portfolio and risk analytics in Python. pyfolio fork.",
      },
      {
        name: "fincore",
        url: "https://github.com/cloudQuant/fincore",
        repo: "https://github.com/cloudQuant/fincore",
        tags: ["Python"],
        description:
          "Quantitative performance and risk analytics with 150+ metrics, portfolio optimization, Monte Carlo simulation, and attribution; actively maintained successor to empyrical/pyfolio.",
      },
      {
        name: "fortitudo.tech",
        url: "https://github.com/fortitudo-tech/fortitudo.tech",
        repo: "https://github.com/fortitudo-tech/fortitudo.tech",
        tags: ["Python"],
        description:
          "Conditional Value-at-Risk (CVaR) portfolio optimization and Entropy Pooling views / stress-testing in Python.",
      },
      {
        name: "quantitative-finance-tools",
        url: "https://github.com/omichauhan-lgtm/quantitative-finance-tools",
        repo: "https://github.com/omichauhan-lgtm/quantitative-finance-tools",
        tags: ["Python"],
        description:
          "Library for portfolio optimization (MVO) and rigorous risk metrics (VaR/CVaR).",
      },
      {
        name: "Prop Trader Compass",
        url: "https://otto-ships.github.io/prop-trader-compass/",
        tags: ["Python"],
        description:
          "Interactive risk and payout calculator for Futures and CFD traders; features one-time fee firm comparisons.",
      },
      {
        name: "riskkit",
        url: "https://github.com/HasibVortex369/riskkit",
        repo: "https://github.com/HasibVortex369/riskkit",
        tags: ["Python"],
        description:
          "Framework-agnostic risk-management toolkit for systematic trading — position sizing, drawdown control, a composable stop engine, correlation limits, and portfolio exposure caps, with adapters for backtesting.py, freqtrade, and vectorbt.",
      },
      {
        name: "portfolio",
        url: "https://github.com/dgerlanc/portfolio",
        repo: "https://github.com/dgerlanc/portfolio",
        tags: ["R"],
        description:
          "Analysing equity portfolios.",
      },
      {
        name: "sparseIndexTracking",
        url: "https://github.com/dppalomar/sparseIndexTracking",
        repo: "https://github.com/dppalomar/sparseIndexTracking",
        tags: ["R"],
        description:
          "Portfolio design to track an index.",
      },
      {
        name: "riskParityPortfolio",
        url: "https://github.com/dppalomar/riskParityPortfolio",
        repo: "https://github.com/dppalomar/riskParityPortfolio",
        tags: ["R"],
        description:
          "Blazingly fast design of risk parity portfolios.",
      },
      {
        name: "PortfolioAnalytics",
        url: "https://github.com/braverock/PortfolioAnalytics",
        repo: "https://github.com/braverock/PortfolioAnalytics",
        tags: ["R"],
        description:
          "Portfolio Analysis, Including Numerical Methods for Optimizationof Portfolios.",
      },
      {
        name: "PerformanceAnalytics",
        url: "https://github.com/braverock/PerformanceAnalytics",
        repo: "https://github.com/braverock/PerformanceAnalytics",
        tags: ["R"],
        description:
          "Econometric tools for performance and risk analysis.",
      },
      {
        name: "OnlinePortfolioAnalytics.jl",
        url: "https://github.com/femtotrader/OnlinePortfolioAnalytics.jl",
        repo: "https://github.com/femtotrader/OnlinePortfolioAnalytics.jl",
        tags: ["Julia"],
        description:
          "A Julia quantitative portfolio analytics (risk / performance) via online algorithms.",
      },
      {
        name: "RiskPerf.jl",
        url: "https://github.com/rbeeli/RiskPerf.jl",
        repo: "https://github.com/rbeeli/RiskPerf.jl",
        tags: ["Julia"],
        description:
          "Quantitative risk and performance analysis package for financial time series powered by the Julia language.",
      },
      {
        name: "portfolio-allocation",
        url: "https://github.com/lequant40/portfolio_allocation_js",
        repo: "https://github.com/lequant40/portfolio_allocation_js",
        tags: ["JavaScript"],
        description:
          "PortfolioAllocation is a JavaScript library designed to help constructing financial portfolios made of several assets: bonds, commodities, cryptocurrencies, currencies, exchange traded funds (ETFs), mutual funds, stocks...",
      },
      {
        name: "Ghostfolio",
        url: "https://github.com/ghostfolio/ghostfolio",
        repo: "https://github.com/ghostfolio/ghostfolio",
        tags: ["JavaScript"],
        description:
          "Wealth management software to keep track of financial assets like stocks, ETFs or cryptocurrencies and make solid, data-driven investment decisions.",
      },
      {
        name: "rebalance",
        url: "https://github.com/cjroth/rebalance",
        repo: "https://github.com/cjroth/rebalance",
        tags: ["JavaScript"],
        description:
          "Interactive portfolio rebalancing tool that imports brokerage CSV data, sets target allocations, and generates trade instructions.",
      },
    ],
  },
  {
    name: "Factor Analysis",
    entries: [
      {
        name: "Alpha Skills",
        url: "https://github.com/VernonOY/alpha-skills",
        repo: "https://github.com/VernonOY/alpha-skills",
        tags: ["Python"],
        description:
          "AI skills for quantitative factor research: discover, evaluate, mine, backtest, and monitor factors through any AI coding assistant. Supports A-share, HK, and US markets.",
      },
      {
        name: "alphalens",
        url: "https://github.com/quantopian/alphalens",
        repo: "https://github.com/quantopian/alphalens",
        tags: ["Python"],
        description:
          "Performance analysis of predictive alpha factors.",
      },
      {
        name: "alphalens-reloaded",
        url: "https://github.com/stefan-jansen/alphalens-reloaded",
        repo: "https://github.com/stefan-jansen/alphalens-reloaded",
        tags: ["Python"],
        description:
          "Performance analysis of predictive (alpha) stock factors.",
      },
      {
        name: "Spectre",
        url: "https://github.com/Heerozh/spectre",
        repo: "https://github.com/Heerozh/spectre",
        tags: ["Python"],
        description:
          "GPU-accelerated Factors analysis library and Backtester.",
      },
      {
        name: "ml-quant-trading",
        url: "https://github.com/initial-d/ml-quant-trading",
        repo: "https://github.com/initial-d/ml-quant-trading",
        tags: ["Python"],
        description:
          "PyTorch research stack for multi-factor analysis, bias correction, portfolio optimization, and reproducible backtesting.",
      },
      {
        name: "QuantGPT",
        url: "https://github.com/Miasyster/QuantGPT",
        repo: "https://github.com/Miasyster/QuantGPT",
        tags: ["Python"],
        description:
          "Agent-driven A-share factor research engine with 8 MCP tools covering hypothesis design, backtesting, scoring, and anti-overfit detection.",
      },
      {
        name: "quant-lab-alpha",
        url: "https://github.com/husainm97/quant-lab-alpha",
        repo: "https://github.com/husainm97/quant-lab-alpha",
        tags: ["Python"],
        description:
          "Open-source investment analytics platform bridging academic research and retail finance.",
      },
      {
        name: "Perception-XAlpha Lite",
        url: "https://github.com/xuxingjiankr-cpu/perception-xalpha-lite",
        repo: "https://github.com/xuxingjiankr-cpu/perception-xalpha-lite",
        tags: ["Python"],
        description:
          "Backtest-overfitting audit for factor research: CSCV probability of backtest overfitting, deflated Sharpe against the declared trial count, White's Reality Check, point-in-time universe membership and disclosure-date alignment. Ships a worked example in which 24 pure-noise series produce a 1.11 Sharpe and the audit says so.",
      },
      {
        name: "covFactorModel",
        url: "https://github.com/dppalomar/covFactorModel",
        repo: "https://github.com/dppalomar/covFactorModel",
        tags: ["R"],
        description:
          "Covariance matrix estimation via factor models.",
      },
      {
        name: "FactorAnalytics",
        url: "https://github.com/braverock/FactorAnalytics",
        repo: "https://github.com/braverock/FactorAnalytics",
        tags: ["R"],
        description:
          "The FactorAnalytics package contains fitting and analysis methods for the three main types of factor models used in conjunction with portfolio construction, optimization and risk management, namely fundamental factor models, time series factor models and statistical factor models.",
      },
      {
        name: "Expected Returns",
        url: "https://github.com/JustinMShea/ExpectedReturns",
        repo: "https://github.com/JustinMShea/ExpectedReturns",
        tags: ["R"],
        description:
          "Solutions for enhancing portfolio diversification and replications of seminal papers with R, most of which are discussed in one of the best investment references of the recent decade, Expected Returns: An Investors Guide to Harvesting Market Rewards by Antti Ilmanen.",
      },
    ],
  },
  {
    name: "Sentiment Analysis & Alternative Data",
    entries: [
      {
        name: "Asset News Sentiment Analyzer",
        url: "https://github.com/KVignesh122/AssetNewsSentimentAnalyzer",
        repo: "https://github.com/KVignesh122/AssetNewsSentimentAnalyzer",
        tags: ["Python"],
        description:
          "Sentiment analysis and report generation package for financial assets and securities utilizing GPT models.",
      },
      {
        name: "Social Stock Sentiment API",
        url: "https://api.adanos.org/docs",
        tags: ["Python"],
        description:
          "REST API analyzing Reddit and X/Twitter for stock mentions and sentiment, providing buzz scores, trending stocks, and AI-generated trend explanations.",
      },
      {
        name: "CoWorker Fin-Agent",
        url: "https://github.com/ZiwayZhao/agent-coworker",
        repo: "https://github.com/ZiwayZhao/agent-coworker",
        tags: ["Python"],
        description:
          "LLM-powered A-share stock analysis via P2P agent collaboration. Technical analysis (MA60, volume-price patterns, golden eye), deep research reports using proprietary methodology, and market state summaries. Analysis logic stays private via Skill-as-API protocol.",
      },
      {
        name: "StockKit",
        url: "https://stockkit.net/",
        repo: "https://github.com/kentmswood-ui/stockkit",
        tags: ["TypeScript"],
        description:
          "Free AI-powered stock research reports for US, China & HK using Claude Opus and multi-model AI with 20+ technical indicators.",
      },
      {
        name: "AlphaAI",
        url: "https://alphai.io/developers",
        repo: "https://github.com/makeev/alphai-mcp",
        tags: ["Python"],
        description:
          "Pre-analyzed financial news via REST API and MCP for AI agents: per-ticker impact and sentiment, a category, and a 1-10 relevance score on every story, plus structured SEC Form 4 insider data. Free tier, no card.",
      },
    ],
  },
  {
    name: "Time Series Analysis",
    entries: [
      {
        name: "ARCH",
        url: "https://github.com/bashtage/arch",
        repo: "https://github.com/bashtage/arch",
        tags: ["Python"],
        description:
          "ARCH models in Python.",
      },
      {
        name: "statsmodels",
        url: "http://statsmodels.sourceforge.net",
        repo: "https://github.com/statsmodels/statsmodels",
        tags: ["Python"],
        description:
          "Python module that allows users to explore data, estimate statistical models, and perform statistical tests.",
      },
      {
        name: "dynts",
        url: "https://github.com/quantmind/dynts",
        repo: "https://github.com/quantmind/dynts",
        tags: ["Python"],
        description:
          "Python package for timeseries analysis and manipulation.",
      },
      {
        name: "PyFlux",
        url: "https://github.com/RJT1990/pyflux",
        repo: "https://github.com/RJT1990/pyflux",
        tags: ["Python"],
        description:
          "Python library for timeseries modelling and inference (frequentist and Bayesian) on models.",
      },
      {
        name: "tsfresh",
        url: "https://github.com/blue-yonder/tsfresh",
        repo: "https://github.com/blue-yonder/tsfresh",
        tags: ["Python"],
        description:
          "Automatic extraction of relevant features from time series.",
      },
      {
        name: "Facebook Prophet",
        url: "https://github.com/facebook/prophet",
        repo: "https://github.com/facebook/prophet",
        tags: ["Python"],
        description:
          "Tool for producing high quality forecasts for time series data that has multiple seasonality with linear or non-linear growth.",
      },
      {
        name: "tsmoothie",
        url: "https://github.com/cerlymarco/tsmoothie",
        repo: "https://github.com/cerlymarco/tsmoothie",
        tags: ["Python"],
        description:
          "A python library for time-series smoothing and outlier detection in a vectorized way.",
      },
      {
        name: "pmdarima",
        url: "https://github.com/alkaline-ml/pmdarima",
        repo: "https://github.com/alkaline-ml/pmdarima",
        tags: ["Python"],
        description:
          "A statistical library designed to fill the void in Python's time series analysis capabilities, including the equivalent of R's auto.arima function.",
      },
      {
        name: "gluon-ts",
        url: "https://github.com/awslabs/gluon-ts",
        repo: "https://github.com/awslabs/gluon-ts",
        tags: ["Python"],
        description:
          "vProbabilistic time series modeling in Python.",
      },
      {
        name: "OmniOracle",
        url: "https://github.com/cesabici-bit/omni-oracle",
        repo: "https://github.com/cesabici-bit/omni-oracle",
        tags: ["Python"],
        description:
          "Automatic discovery of non-trivial statistical relationships across 500+ time series from FRED, World Bank, EIA, and NOAA using mutual information screening, lagged MI directional testing, and FDR correction.",
      },
      {
        name: "functime",
        url: "https://github.com/functime-org/functime",
        repo: "https://github.com/functime-org/functime",
        tags: ["Python"],
        description:
          "Time-series machine learning at scale. Built with Polars for embarrassingly parallel feature extraction and forecasts on panel data.",
      },
      {
        name: "etf-pattern-match-pybind11",
        url: "https://github.com/redamancy231-create/etf-pattern-match-pybind11",
        repo: "https://github.com/redamancy231-create/etf-pattern-match-pybind11",
        tags: ["Python", "C++"],
        description:
          "High-performance ETF pattern matching via DTW with cosine pre-filtering. 43× DTW and 58× pattern-match speedup over pure Python using pybind11/C++20. Includes Jupyter notebook with full algorithm walkthrough.",
      },
      {
        name: "wasserstein-btc",
        url: "https://github.com/AccursedGalaxy/wasserstein-btc",
        repo: "https://github.com/AccursedGalaxy/wasserstein-btc",
        tags: ["Python"],
        description:
          "Distributional forecasting of crypto log-returns by tangent-space geodesic extrapolation on the 2-Wasserstein manifold (quantile-function coordinates). Walk-forward CRPS evaluation over 6.75 years across 4 assets × 3 horizons; benchmarked against classical baselines (Static / RW-Drift / HS-Bootstrap / GARCH-N / GARCH-t / GJR-GARCH-t) and a named-econometric panel (HAR-RV, CAViaR-SAV, Markov-switching Normal, FIGARCH, AR(1) Stochastic Volatility, bivariate VAR+GARCH). Live dashboard.",
      },
      {
        name: "tseries",
        url: "https://cran.r-project.org/web/packages/tseries/index.html",
        tags: ["R"],
        description:
          "Time Series Analysis and Computational Finance.",
      },
      {
        name: "fGarch",
        url: "https://cran.r-project.org/web/packages/fGarch/index.html",
        tags: ["R"],
        description:
          "Rmetrics - Autoregressive Conditional Heteroskedastic Modelling.",
      },
      {
        name: "timeSeries",
        url: "https://cran.r-project.org/web/packages/timeSeries/index.html",
        tags: ["R"],
        description:
          "Rmetrics - Financial Time Series Objects.",
      },
      {
        name: "rugarch",
        url: "https://github.com/alexiosg/rugarch",
        repo: "https://github.com/alexiosg/rugarch",
        tags: ["R"],
        description:
          "Univariate GARCH Models.",
      },
      {
        name: "rmgarch",
        url: "https://github.com/alexiosg/rmgarch",
        repo: "https://github.com/alexiosg/rmgarch",
        tags: ["R"],
        description:
          "Multivariate GARCH Models.",
      },
      {
        name: "tidypredict",
        url: "https://github.com/edgararuiz/tidypredict",
        repo: "https://github.com/edgararuiz/tidypredict",
        tags: ["R"],
        description:
          "Run predictions inside the database <https://tidypredict.netlify.com/>.",
      },
      {
        name: "tidyquant",
        url: "https://github.com/business-science/tidyquant",
        repo: "https://github.com/business-science/tidyquant",
        tags: ["R"],
        description:
          "Bringing financial analysis to the tidyverse.",
      },
      {
        name: "timetk",
        url: "https://github.com/business-science/timetk",
        repo: "https://github.com/business-science/timetk",
        tags: ["R"],
        description:
          "A toolkit for working with time series in R.",
      },
      {
        name: "tibbletime",
        url: "https://github.com/business-science/tibbletime",
        repo: "https://github.com/business-science/tibbletime",
        tags: ["R"],
        description:
          "Built on top of the tidyverse, tibbletime is an extension that allows for the creation of time aware tibbles through the setting of a time index.",
      },
      {
        name: "matrixprofile",
        url: "https://github.com/matrix-profile-foundation/matrixprofile",
        repo: "https://github.com/matrix-profile-foundation/matrixprofile",
        tags: ["R"],
        description:
          "Time series data mining library built on top of the novel Matrix Profile data structure and algorithms.",
      },
      {
        name: "garchmodels",
        url: "https://github.com/AlbertoAlmuinha/garchmodels",
        repo: "https://github.com/AlbertoAlmuinha/garchmodels",
        tags: ["R"],
        description:
          "A parsnip backend for GARCH models.",
      },
      {
        name: "TimeSeries.jl",
        url: "https://github.com/JuliaStats/TimeSeries.jl",
        repo: "https://github.com/JuliaStats/TimeSeries.jl",
        tags: ["Julia"],
        description:
          "Time series toolkit for Julia.",
      },
      {
        name: "TimeFrames.jl",
        url: "https://github.com/femtotrader/TimeFrames.jl",
        repo: "https://github.com/femtotrader/TimeFrames.jl",
        tags: ["Julia"],
        description:
          "A Julia library that defines TimeFrame (essentially for resampling TimeSeries).",
      },
      {
        name: "PineForge",
        url: "https://github.com/pineforge-4pass/pineforge-engine",
        repo: "https://github.com/pineforge-4pass/pineforge-engine",
        tags: ["C++"],
        description:
          "Deterministic offline PineScript v6 → C++ backtest runtime, validated trade-for-trade against TradingView (245/246 strict, 0 engine bugs). Runs locally via Docker and is drivable by AI agents through a bundled MCP server.",
      },
    ],
  },
  {
    name: "Market Data & Data Sources",
    entries: [
      {
        name: "Korea Stock Data",
        url: "https://github.com/na77tech-creator/aikstockdata",
        repo: "https://github.com/na77tech-creator/aikstockdata",
        tags: ["Data"],
        description:
          "Free Korean equity data: KOSPI/KOSDAQ settled closes with 250 trading days of per-stock history, DART regulatory filings and earnings, published every trading day as JSON/CSV. No signup or API key, CORS open. OpenAPI 3.1 spec and MCP server included.",
      },
      {
        name: "BTC Orderbook Microstructure Research",
        url: "https://github.com/whoareunot/btc-orderbook-research",
        repo: "https://github.com/whoareunot/btc-orderbook-research",
        tags: ["Jupyter Notebook"],
        description:
          "statistical analysis of Binance BTC/USDT orderbook: OBI, CVD, spread.",
      },
      {
        name: "OpenBB Terminal",
        url: "https://github.com/OpenBB-finance/OpenBBTerminal",
        repo: "https://github.com/OpenBB-finance/OpenBBTerminal",
        tags: ["Python"],
        description:
          "Terminal for investment research for everyone.",
      },
      {
        name: "Fincept Terminal",
        url: "https://github.com/Fincept-Corporation/FinceptTerminal",
        repo: "https://github.com/Fincept-Corporation/FinceptTerminal",
        tags: ["Python"],
        description:
          "Advance Data Based A.I Terminal for all Types of Financial Asset Research.",
      },
      {
        name: "yfinance",
        url: "https://github.com/ranaroussi/yfinance",
        repo: "https://github.com/ranaroussi/yfinance",
        tags: ["Python"],
        description:
          "Yahoo! Finance market data downloader (+faster Pandas Datareader).",
      },
      {
        name: "treasurydirect",
        url: "https://github.com/moshejs/treasurydirect",
        repo: "https://github.com/moshejs/treasurydirect",
        tags: ["TypeScript"],
        description:
          "Zero-dependency client for the US TreasuryDirect API: auction results, upcoming auctions, CUSIP lookups, and Debt to the Penny; no API key required.",
      },
      {
        name: "treasury-fiscaldata",
        url: "https://github.com/moshejs/treasury-fiscaldata",
        repo: "https://github.com/moshejs/treasury-fiscaldata",
        tags: ["TypeScript"],
        description:
          "Typed client for the US Treasury FiscalData API (debt, average interest rates, exchange rates) with pagination and filtering; no API key required.",
      },
      {
        name: "newyorkfed",
        url: "https://github.com/moshejs/newyorkfed",
        repo: "https://github.com/moshejs/newyorkfed",
        tags: ["TypeScript"],
        description:
          "Client for the NY Fed Markets Data API: SOFR/EFFR/OBFR reference rates, SOFR averages and index, and SOMA holdings; no API key required.",
      },
      {
        name: "commitments-of-traders",
        url: "https://github.com/moshejs/commitments-of-traders",
        repo: "https://github.com/moshejs/commitments-of-traders",
        tags: ["TypeScript"],
        description:
          "Client for the CFTC Commitments of Traders reports (Legacy, Disaggregated, TFF; futures-only and combined) via the official Socrata API.",
      },
      {
        name: "coinpaprika-api-python-client",
        url: "https://github.com/coinpaprika/coinpaprika-api-python-client",
        repo: "https://github.com/coinpaprika/coinpaprika-api-python-client",
        tags: ["Python"],
        description:
          "Free crypto market data API client. 12,000+ coins, 350+ exchanges, tickers, OHLCV, historical prices. No API key for free tier.",
      },
      {
        name: "FillBench",
        url: "https://fillbench.com",
        repo: "https://github.com/sircharli3/fillbench-data",
        tags: [],
        description:
          "Reproducible crypto exchange REST API latency benchmarks (p50/p95/p99 and TLS connect time) measured every 2 hours from a fixed US East server. Raw data:",
      },
      {
        name: "defeatbeta-api",
        url: "https://github.com/defeat-beta/defeatbeta-api",
        repo: "https://github.com/defeat-beta/defeatbeta-api",
        tags: ["Python"],
        description:
          "An open-source alternative to Yahoo Finance's market data APIs with higher reliability.",
      },
      {
        name: "financekit-mcp",
        url: "https://github.com/vdalhambra/financekit-mcp",
        repo: "https://github.com/vdalhambra/financekit-mcp",
        tags: ["Python"],
        description:
          "MCP server (Model Context Protocol) exposing 17 tools for AI agents to perform quantitative analysis: real-time stock quotes, full technical analysis (RSI, MACD, Bollinger, ADX, Stochastic, ATR, OBV + pattern detection with structured verdicts), crypto prices via CoinGecko, risk metrics (VaR, Sharpe, Sortino, Beta, Max Drawdown), correlation matrix, options chains, earnings calendar, sector rotation, and portfolio analysis. Works with Claude Desktop, Cursor, Windsurf. No API keys for core tools. FastMCP 3.2.",
      },
      {
        name: "dexpaprika-sdk-python",
        url: "https://github.com/coinpaprika/dexpaprika-sdk-python",
        repo: "https://github.com/coinpaprika/dexpaprika-sdk-python",
        tags: ["Python"],
        description:
          "Free DEX data API client. 36 blockchains, 36M+ pools, 33M+ tokens, real-time SSE streaming, OHLCV. No API key needed.",
      },
      {
        name: "pricehub",
        url: "https://github.com/eslazarev/pricehub",
        repo: "https://github.com/eslazarev/pricehub",
        tags: ["Python"],
        description:
          "Unified package for collecting OHLC prices from Binance, Bybit, Coinbase, OKX, Kraken, KuCoin, and Bitget (spot & futures) into a DataFrame, with flexible timestamp inputs and a wide range of intervals.",
      },
      {
        name: "Helium MCP",
        url: "https://heliumtrades.com/mcp-page/",
        tags: ["Python"],
        description:
          "Live stock/ETF/crypto data with AI-generated bull/bear cases and price forecasts, proprietary ML options pricing with probability ITM and fair value, and news bias scoring across 5,000+ sources. Available as MCP server or API. Free tier: 50 queries, no signup.",
      },
      {
        name: "findatapy",
        url: "https://github.com/cuemacro/findatapy",
        repo: "https://github.com/cuemacro/findatapy",
        tags: ["Python"],
        description:
          "Python library to download market data via Bloomberg, Quandl, Yahoo etc.",
      },
      {
        name: "googlefinance",
        url: "https://github.com/hongtaocai/googlefinance",
        repo: "https://github.com/hongtaocai/googlefinance",
        tags: ["Python"],
        description:
          "Python module to get real-time stock data from Google Finance API.",
      },
      {
        name: "Horus Flow",
        url: "https://github.com/horustechltd/horus-flow-mcp",
        repo: "https://github.com/horustechltd/horus-flow-mcp",
        tags: ["Python"],
        description:
          "Sub-second L2 orderflow intelligence MCP server for institutional-grade market microstructure analysis.",
      },
      {
        name: "AlphaSMO",
        url: "https://github.com/alphasmo/alphasmo-tools",
        repo: "https://github.com/alphasmo/alphasmo-tools",
        tags: ["TypeScript"],
        description:
          "CLI + MCP server for SEC 13F institutional holdings, Form 4 insider trading, and smart money convergence signals (tickers where hedge funds and company insiders are both buying). Free anonymous tier, no signup required.",
      },
      {
        name: "yahoo-finance",
        url: "https://github.com/lukaszbanasiak/yahoo-finance",
        repo: "https://github.com/lukaszbanasiak/yahoo-finance",
        tags: ["Python"],
        description:
          "Python module to get stock data from Yahoo! Finance.",
      },
      {
        name: "pandas-datareader",
        url: "https://github.com/pydata/pandas-datareader",
        repo: "https://github.com/pydata/pandas-datareader",
        tags: ["Python"],
        description:
          "Python module to get data from various sources (Google Finance, Yahoo Finance, FRED, OECD, Fama/French, World Bank, Eurostat...) into Pandas datastructures such as DataFrame, Panel with a caching mechanism.",
      },
      {
        name: "pandas-finance",
        url: "https://github.com/davidastephens/pandas-finance",
        repo: "https://github.com/davidastephens/pandas-finance",
        tags: ["Python"],
        description:
          "High level API for access to and analysis of financial data.",
      },
      {
        name: "pyhoofinance",
        url: "https://github.com/innes213/pyhoofinance",
        repo: "https://github.com/innes213/pyhoofinance",
        tags: ["Python"],
        description:
          "Rapidly queries Yahoo Finance for multiple tickers and returns typed data for analysis.",
      },
      {
        name: "yfinanceapi",
        url: "https://github.com/Karthik005/yfinanceapi",
        repo: "https://github.com/Karthik005/yfinanceapi",
        tags: ["Python"],
        description:
          "Finance API for Python.",
      },
      {
        name: "yql-finance",
        url: "https://github.com/slawek87/yql-finance",
        repo: "https://github.com/slawek87/yql-finance",
        tags: ["Python"],
        description:
          "yql-finance is simple and fast. API returns stock closing prices for current period of time and current stock ticker (i.e. APPL, GOOGL).",
      },
      {
        name: "ystockquote",
        url: "https://github.com/cgoldberg/ystockquote",
        repo: "https://github.com/cgoldberg/ystockquote",
        tags: ["Python"],
        description:
          "Retrieve stock quote data from Yahoo Finance.",
      },
      {
        name: "jugaad-data",
        url: "https://github.com/jugaad-py/jugaad-data",
        repo: "https://github.com/jugaad-py/jugaad-data",
        tags: ["Python"],
        description:
          "Download historical and live stock data from NSE (National Stock Exchange of India), BSE, and RBI.",
      },
      {
        name: "nsetools",
        url: "https://github.com/vsjha18/nsetools",
        repo: "https://github.com/vsjha18/nsetools",
        tags: ["Python"],
        description:
          "Python library for extracting real-time data from National Stock Exchange (India).",
      },
      {
        name: "wallstreet",
        url: "https://github.com/mcdallas/wallstreet",
        repo: "https://github.com/mcdallas/wallstreet",
        tags: ["Python"],
        description:
          "Real time stock and option data.",
      },
      {
        name: "stock_extractor",
        url: "https://github.com/ZachLiuGIS/stock_extractor",
        repo: "https://github.com/ZachLiuGIS/stock_extractor",
        tags: ["Python"],
        description:
          "General Purpose Stock Extractors from Online Resources.",
      },
      {
        name: "Stockex",
        url: "https://github.com/cttn/Stockex",
        repo: "https://github.com/cttn/Stockex",
        tags: ["Python"],
        description:
          "Python wrapper for Yahoo! Finance API.",
      },
      {
        name: "SwapAPI",
        url: "https://github.com/swap-api/swap-api",
        repo: "https://github.com/swap-api/swap-api",
        tags: ["Python"],
        description:
          "Free DEX aggregator API returning executable swap calldata across 46 EVM chains. No API key required.",
      },
      {
        name: "finsymbols",
        url: "https://github.com/skillachie/finsymbols",
        repo: "https://github.com/skillachie/finsymbols",
        tags: ["Python"],
        description:
          "Obtains stock symbols and relating information for SP500, AMEX, NYSE, and NASDAQ.",
      },
      {
        name: "FRB",
        url: "https://github.com/avelkoski/FRB",
        repo: "https://github.com/avelkoski/FRB",
        tags: ["Python"],
        description:
          "Python Client for FRED® API.",
      },
      {
        name: "inquisitor",
        url: "https://github.com/econdb/inquisitor",
        repo: "https://github.com/econdb/inquisitor",
        tags: ["Python"],
        description:
          "Python Interface to Econdb.com API.",
      },
      {
        name: "yfi",
        url: "https://github.com/nickelkr/yfi",
        repo: "https://github.com/nickelkr/yfi",
        tags: ["Python"],
        description:
          "Yahoo! YQL library.",
      },
      {
        name: "chinesestockapi",
        url: "https://pypi.org/project/chinesestockapi/",
        tags: ["Python"],
        description:
          "Python API to get Chinese stock price. (Last updated: 2015-03-21).",
      },
      {
        name: "exchange",
        url: "https://github.com/akarat/exchange",
        repo: "https://github.com/akarat/exchange",
        tags: ["Python"],
        description:
          "Get current exchange rate.",
      },
      {
        name: "unirate-api",
        url: "https://github.com/UniRate-API/unirate-api-python",
        repo: "https://github.com/UniRate-API/unirate-api-python",
        tags: ["Python"],
        description:
          "Client for UniRateAPI providing real-time and historical exchange rates for 170+ fiat and crypto currencies plus VAT rates, with a free tier and no credit card required.",
      },
      {
        name: "Chart Library",
        url: "https://github.com/grahammccain/chart-library-mcp",
        repo: "https://github.com/grahammccain/chart-library-mcp",
        tags: ["Python"],
        description:
          "Historical chart pattern similarity search API. 24M+ pre-computed embeddings across 15K+ symbols and 10 years of data using pgvector. Returns forward returns, regime analysis, and pattern detection. Also available as MCP server. Website",
      },
      {
        name: "ticks",
        url: "https://github.com/jamescnowell/ticks",
        repo: "https://github.com/jamescnowell/ticks",
        tags: ["Python"],
        description:
          "Simple command line tool to get stock ticker data.",
      },
      {
        name: "pybbg",
        url: "https://github.com/bpsmith/pybbg",
        repo: "https://github.com/bpsmith/pybbg",
        tags: ["Python"],
        description:
          "Python interface to Bloomberg COM APIs.",
      },
      {
        name: "ccy",
        url: "https://github.com/lsbardel/ccy",
        repo: "https://github.com/lsbardel/ccy",
        tags: ["Python"],
        description:
          "Python module for currencies.",
      },
      {
        name: "tushare",
        url: "https://pypi.org/project/tushare/",
        tags: ["Python"],
        description:
          "A utility for crawling historical and Real-time Quotes data of China stocks. (Last updated: 2024-08-27).",
      },
      {
        name: "twmarketdata",
        url: "https://pypi.org/project/twmarketdata/",
        tags: ["Python"],
        description:
          "Client for the TW Market Data API: Taiwan stock-market data (official-source, reconciled, point-in-time safe), REST + MCP server, free trial tier. <https://twmarketdata.com>.",
      },
      {
        name: "edinetdb",
        url: "https://edinetdb.com/",
        tags: ["Python"],
        description:
          "Free API and MCP server for Japanese company financials. Normalizes EDINET XBRL across JP-GAAP, IFRS, and US-GAAP for 3,800+ listed companies with 90 metrics, screening, and securities report text.",
      },
      {
        name: "SECfinAPI",
        url: "https://www.secfinapi.com",
        repo: "https://github.com/michalperni11-gif/secfinapi-mcp",
        tags: ["TypeScript"],
        description:
          "Standardized SEC EDGAR financials (income statement, balance sheet, cash flow, 40+ ratios) for ~19,000 US public companies, normalized from XBRL. REST API + MCP server for Claude/Cursor. Free tier.",
      },
      {
        name: "edinet-mcp",
        url: "https://github.com/ajtgjmdjp/edinet-mcp",
        repo: "https://github.com/ajtgjmdjp/edinet-mcp",
        tags: ["Python"],
        description:
          "Parse Japanese XBRL financial statements from EDINET with 161 normalized labels, 26 financial metrics, and multi-company screening.",
      },
      {
        name: "estat-mcp",
        url: "https://github.com/ajtgjmdjp/estat-mcp",
        repo: "https://github.com/ajtgjmdjp/estat-mcp",
        tags: ["Python"],
        description:
          "Access Japanese government statistics (e-Stat) covering population, GDP, CPI, labor, and trade data with MCP integration and Polars export.",
      },
      {
        name: "tdnet-disclosure-mcp",
        url: "https://github.com/ajtgjmdjp/tdnet-disclosure-mcp",
        repo: "https://github.com/ajtgjmdjp/tdnet-disclosure-mcp",
        tags: ["Python"],
        description:
          "Access Japanese timely disclosures (TDNet) via MCP. Retrieve earnings, dividends, forecasts, buybacks, and other filings for 4,000+ listed companies. No API key required.",
      },
      {
        name: "bigtech-ai-stakes",
        url: "https://github.com/YichengYang-Ethan/bigtech-ai-stakes",
        repo: "https://github.com/YichengYang-Ethan/bigtech-ai-stakes",
        tags: ["Python"],
        description:
          "Open dataset of U.S. public-company equity stakes in Anthropic and OpenAI from primary 10-K / 10-Q / 8-K filings, court records, and press releases. Each row tagged with a confidence flag (V verified, P probable, S speculative).",
      },
      {
        name: "cn_stock_src",
        url: "https://github.com/jealous/cn_stock_src",
        repo: "https://github.com/jealous/cn_stock_src",
        tags: ["Python"],
        description:
          "Utility for retrieving basic China stock data from different sources.",
      },
      {
        name: "coinmarketcap",
        url: "https://github.com/barnumbirr/coinmarketcap",
        repo: "https://github.com/barnumbirr/coinmarketcap",
        tags: ["Python"],
        description:
          "Python API for coinmarketcap.",
      },
      {
        name: "coinpulse",
        url: "https://github.com/soutone/coinpulse-python",
        repo: "https://github.com/soutone/coinpulse-python",
        tags: ["Python"],
        description:
          "Python SDK for cryptocurrency portfolio tracking with real-time prices, P/L calculations, and price alerts. Free tier available.",
      },
      {
        name: "after-hours",
        url: "https://github.com/datawrestler/after-hours",
        repo: "https://github.com/datawrestler/after-hours",
        tags: ["Python"],
        description:
          "Obtain pre market and after hours stock prices for a given symbol.",
      },
      {
        name: "bronto-python",
        url: "https://pypi.org/project/bronto-python/",
        tags: ["Python"],
        description:
          "Bronto API Integration for Python.",
      },
      {
        name: "pytdx",
        url: "https://github.com/rainx/pytdx",
        repo: "https://github.com/rainx/pytdx",
        tags: ["Python"],
        description:
          "Python Interface for retrieving chinese stock realtime quote data from TongDaXin Nodes.",
      },
      {
        name: "pdblp",
        url: "https://github.com/matthewgilbert/pdblp",
        repo: "https://github.com/matthewgilbert/pdblp",
        tags: ["Python"],
        description:
          "A simple interface to integrate pandas and the Bloomberg Open API.",
      },
      {
        name: "BloombergFetch",
        url: "https://github.com/ArturSepp/BloombergFetch",
        repo: "https://github.com/ArturSepp/BloombergFetch",
        tags: ["Python"],
        description:
          "Bloomberg Desktop API data (prices, implied volatilities, fundamentals) as pandas DataFrames via blpapi.",
      },
      {
        name: "tiingo",
        url: "https://github.com/hydrosquall/tiingo-python",
        repo: "https://github.com/hydrosquall/tiingo-python",
        tags: ["Python"],
        description:
          "Python interface for daily composite prices/OHLC/Volume + Real-time News Feeds, powered by the Tiingo Data Platform.",
      },
      {
        name: "finlight",
        url: "https://finlight.me",
        repo: "https://github.com/jubeiargh/finlight-client-py",
        tags: ["Python", "TypeScript"],
        description:
          "Real-time financial and geopolitical news API with sentiment analysis and entity tagging over REST and WebSocket.",
      },
      {
        name: "iexfinance",
        url: "https://github.com/addisonlynch/iexfinance",
        repo: "https://github.com/addisonlynch/iexfinance",
        tags: ["Python"],
        description:
          "Python Interface for retrieving real-time and historical prices and equities data from The Investor's Exchange.",
      },
      {
        name: "pyEX",
        url: "https://github.com/timkpaine/pyEX",
        repo: "https://github.com/timkpaine/pyEX",
        tags: ["Python"],
        description:
          "Python interface to IEX with emphasis on pandas, support for streaming data, premium data, points data (economic, rates, commodities), and technical indicators.",
      },
      {
        name: "alpaca-trade-api",
        url: "https://github.com/alpacahq/alpaca-trade-api-python",
        repo: "https://github.com/alpacahq/alpaca-trade-api-python",
        tags: ["Python"],
        description:
          "Python interface for retrieving real-time and historical prices from Alpaca API as well as trade execution.",
      },
      {
        name: "metatrader5",
        url: "https://pypi.org/project/MetaTrader5/",
        tags: ["Python"],
        description:
          "API Connector to MetaTrader 5 Terminal. (Last updated: 2026-02-20).",
      },
      {
        name: "akshare",
        url: "https://github.com/jindaxiang/akshare",
        repo: "https://github.com/jindaxiang/akshare",
        tags: ["Python"],
        description:
          "AkShare is an elegant and simple financial data interface library for Python, built for human beings! <https://akshare.readthedocs.io>.",
      },
      {
        name: "yahooquery",
        url: "https://github.com/dpguthrie/yahooquery",
        repo: "https://github.com/dpguthrie/yahooquery",
        tags: ["Python"],
        description:
          "Python interface for retrieving data through unofficial Yahoo Finance API.",
      },
      {
        name: "investpy",
        url: "https://github.com/alvarobartt/investpy",
        repo: "https://github.com/alvarobartt/investpy",
        tags: ["Python"],
        description:
          "Financial Data Extraction from Investing.com with Python! <https://investpy.readthedocs.io/>.",
      },
      {
        name: "yliveticker",
        url: "https://github.com/yahoofinancelive/yliveticker",
        repo: "https://github.com/yahoofinancelive/yliveticker",
        tags: ["Python"],
        description:
          "Live stream of market data from Yahoo Finance websocket.",
      },
      {
        name: "bbgbridge",
        url: "https://github.com/ran404/bbgbridge",
        repo: "https://github.com/ran404/bbgbridge",
        tags: ["Python"],
        description:
          "Easy to use Bloomberg Desktop API wrapper for Python.",
      },
      {
        name: "polygon.io",
        url: "https://github.com/polygon-io/client-python",
        repo: "https://github.com/polygon-io/client-python",
        tags: ["Python"],
        description:
          "A python library for Polygon.io financial data APIs.",
      },
      {
        name: "SiftingIO",
        url: "https://github.com/SiftingIO/sdk-python",
        repo: "https://github.com/SiftingIO/sdk-python",
        tags: ["Python"],
        description:
          "A python library for Sifting.io financial market data APIs & Websocket.",
      },
      {
        name: "alpha_vantage",
        url: "https://github.com/RomelTorres/alpha_vantage",
        repo: "https://github.com/RomelTorres/alpha_vantage",
        tags: ["Python"],
        description:
          "A python wrapper for Alpha Vantage API for financial data.",
      },
      {
        name: "oilpriceapi",
        url: "https://github.com/OilpriceAPI/python-sdk",
        repo: "https://github.com/OilpriceAPI/python-sdk",
        tags: ["Python"],
        description:
          "Python SDK for real-time oil and commodity prices (WTI, Brent, Urals, natural gas, coal) with OpenBB integration.",
      },
      {
        name: "FinanceDataReader",
        url: "https://github.com/FinanceData/FinanceDataReader",
        repo: "https://github.com/FinanceData/FinanceDataReader",
        tags: ["Python"],
        description:
          "Open Source Financial data reader for U.S, Korean, Japanese, Chinese, Vietnamese Stocks.",
      },
      {
        name: "pystlouisfed",
        url: "https://github.com/TomasKoutek/pystlouisfed",
        repo: "https://github.com/TomasKoutek/pystlouisfed",
        tags: ["Python"],
        description:
          "Python client for Federal Reserve Bank of St. Louis API - FRED, ALFRED, GeoFRED and FRASER.",
      },
      {
        name: "python-bcb",
        url: "https://github.com/wilsonfreitas/python-bcb",
        repo: "https://github.com/wilsonfreitas/python-bcb",
        tags: ["Python"],
        description:
          "Python interface to Brazilian Central Bank web services.",
      },
      {
        name: "Dados B3",
        url: "https://dadosb3.com",
        tags: ["REST"],
        description:
          "Fundamental data API for Brazilian listed companies and real-estate funds (FIIs) on B3: ROIC, ROE, margins, point-in-time multiples, FII P/BV and dividend yield, public methodology, free tier.",
      },
      {
        name: "swiss-finance-data",
        url: "https://github.com/EMen11/swiss-finance-data",
        repo: "https://github.com/EMen11/swiss-finance-data",
        tags: ["Python"],
        description:
          "Python package for Swiss financial data (SNB Policy Rate, SARON, CHF FX rates, CPI, SMI equities, Confederation bond yields) from official SNB sources.",
      },
      {
        name: "market-prices",
        url: "https://github.com/maread99/market_prices",
        repo: "https://github.com/maread99/market_prices",
        tags: ["Python"],
        description:
          "Create meaningful OHLCV datasets from knowledge of exchange-calendars (works out-the-box with data from Yahoo Finance).",
      },
      {
        name: "tardis-python",
        url: "https://github.com/tardis-dev/tardis-python",
        repo: "https://github.com/tardis-dev/tardis-python",
        tags: ["Python"],
        description:
          "Python interface for Tardis.dev high frequency crypto market data.",
      },
      {
        name: "lake-api",
        url: "https://github.com/crypto-lake/lake-api",
        repo: "https://github.com/crypto-lake/lake-api",
        tags: ["Python"],
        description:
          "Python interface for Crypto Lake high frequency crypto market data.",
      },
      {
        name: "tessera-api",
        url: "https://github.com/tesseralytics/python-client",
        repo: "https://github.com/tesseralytics/python-client",
        tags: ["Python"],
        description:
          "Official client for Tessera: order-flow-enriched OHLCV, funding-rate, and positioning datasets built from raw Hyperliquid trades, read straight into Polars or DuckDB over a REST API. Website",
      },
      {
        name: "tessa",
        url: "https://github.com/ymyke/tessa",
        repo: "https://github.com/ymyke/tessa",
        tags: ["Python"],
        description:
          "simple, hassle-free access to price information of financial assets (currently based on yfinance and pycoingecko), including search and a symbol class.",
      },
      {
        name: "pandaSDMX",
        url: "https://github.com/dr-leo/pandaSDMX",
        repo: "https://github.com/dr-leo/pandaSDMX",
        tags: ["Python"],
        description:
          "Python package that implements SDMX 2.1 (ISO 17369:2013), a format for exchange of statistical data and metadata used by national statistical agencies, central banks, and international organisations.",
      },
      {
        name: "cif",
        url: "https://github.com/LenkaV/CIF",
        repo: "https://github.com/LenkaV/CIF",
        tags: ["Python"],
        description:
          "Python package that include few composite indicators, which summarize multidimensional relationships between individual economic indicators.",
      },
      {
        name: "finagg",
        url: "https://github.com/theOGognf/finagg",
        repo: "https://github.com/theOGognf/finagg",
        tags: ["Python"],
        description:
          "finagg is a Python package that provides implementations of popular and free financial APIs, tools for aggregating historical data from those APIs into SQL databases, and tools for transforming aggregated data into features useful for analysis and AI/ML.",
      },
      {
        name: "FinanceDatabase",
        url: "https://github.com/JerBouma/FinanceDatabase",
        repo: "https://github.com/JerBouma/FinanceDatabase",
        tags: ["Python"],
        description:
          "This is a database of 300.000+ symbols containing Equities, ETFs, Funds, Indices, Currencies, Cryptocurrencies and Money Markets.",
      },
      {
        name: "FinanceToolkit",
        url: "https://github.com/JerBouma/FinanceToolkit",
        repo: "https://github.com/JerBouma/FinanceToolkit",
        tags: ["Python"],
        description:
          "Toolkit with 200+ financial metrics including 80+ financial ratios, 30+ technical indicators, 20+ risk and performance metrics and 50+ macro indicators which pulls from Financial Modeling Prep, Yahoo Finance, OECD, GMBD and more.",
      },
      {
        name: "Trading Strategy",
        url: "https://github.com/tradingstrategy-ai/trading-strategy/",
        repo: "https://github.com/tradingstrategy-ai/trading-strategy/",
        tags: ["Python"],
        description:
          "download price data for decentralised exchanges and lending protocols (DeFi).",
      },
      {
        name: "datamule-python",
        url: "https://github.com/john-friedman/datamule-python",
        repo: "https://github.com/john-friedman/datamule-python",
        tags: ["Python"],
        description:
          "A package to work with SEC data. Incorporates datamule endpoints.",
      },
      {
        name: "fsynth",
        url: "https://github.com/welcra/fsynth",
        repo: "https://github.com/welcra/fsynth",
        tags: ["Python"],
        description:
          "Python library for high-fidelity unlimited synthetic financial data generation using Heston Stochastic Volatility and Merton Jump Diffusion.",
      },
      {
        name: "fedfred",
        url: "https://nikhilxsunder.github.io/fedfred/",
        tags: ["Python"],
        description:
          "FRED & GeoFRED Economic data API with preprocessed dataframe output in pandas/geopandas, polars/polars_st, and dask dataframes/geodataframes.",
      },
      {
        name: "edgar-sec",
        url: "https://edgar-sec-dev-team.github.io/edgar-sec/",
        tags: ["Python"],
        description:
          "EDGAR Financial data API with preprocessed dataclass outputs.",
      },
      {
        name: "edgartools",
        url: "https://github.com/dgunning/edgartools",
        repo: "https://github.com/dgunning/edgartools",
        tags: ["Python"],
        description:
          "AI-native SEC EDGAR library with XBRL financials, clean text extraction, 17+ typed forms, and pandas DataFrames.",
      },
      {
        name: "filingrail-mcp",
        url: "https://pypi.org/project/filingrail-mcp/",
        repo: "https://github.com/adamhudson777/filingrail-mcp",
        tags: ["Python", "MCP"],
        description:
          "MCP server and Python SDK for a SEC EDGAR REST API covering XBRL fundamentals, Form 4 insider trades, 8-K events, 13F holdings and filings, where every record carries the source sec.gov filing URL it came from.",
      },
      {
        name: "disclosure-alpha",
        url: "https://github.com/alwank/disclosure-alpha",
        repo: "https://github.com/alwank/disclosure-alpha",
        tags: ["Python"],
        description:
          "Deterministic SEC filing analytics for 10-K/10-Q: section extraction, tone and boilerplate metrics, year-over-year diff, and reproducible disclosure risk scores. CLI, Python SDK, HTTP panel screener, and MCP — no LLM required.",
      },
      {
        name: "Tradevo Data",
        url: "https://github.com/christianpichichero-max/pit-fundamentals",
        repo: "https://github.com/christianpichichero-max/pit-fundamentals",
        tags: ["Python"],
        description:
          "Point-in-time US equity fundamentals from SEC EDGAR that stamp each figure with the date it first became public and flag later restatements, so fundamental backtests avoid lookahead bias; free CC0 sample of 40 large-caps, with a paid JSON API. Website",
      },
      {
        name: "FilingFirehose",
        url: "https://filingfirehose.com",
        tags: ["Python"],
        description:
          "SEC EDGAR JSON API + free Forensic risk-scoring tool: body-text-classified 8-Ks flagging buried events (~7.3% of Item 8.01 filings), Schedule 13D/G with 21+ activist filers auto-tagged, S-3/424B5 ATM offering detection. Free Forensic risk score 0-100 per ticker grounded in cited SEC filings (leaderboard). Open-source classifier at buried-events-parser. Also exposed as MCP server, ChatGPT GPT, and GitHub Action.",
      },
      {
        name: "FXMacroData",
        url: "https://fxmacrodata.com/",
        repo: "https://github.com/fxmacrodata/fxmacrodata",
        tags: ["Python"],
        description:
          "Real-time forex macroeconomic API for all major currency pairs sourced from central bank announcements.",
      },
      {
        name: "uk-sic-codes",
        url: "https://pypi.org/project/uk-sic-codes/",
        tags: ["Python"],
        description:
          "UK SIC 2007 industry classification code lookup, search, and validation. 731 codes, 21 sections.",
      },
      {
        name: "uk-company-number",
        url: "https://pypi.org/project/uk-company-number/",
        tags: ["Python"],
        description:
          "Validate, format, and identify UK Companies House company numbers. Supports all 27 prefixes.",
      },
      {
        name: "veroq-python",
        url: "https://github.com/Veroq-api/veroq-python",
        repo: "https://github.com/Veroq-api/veroq-python",
        tags: ["Python"],
        description:
          "Financial intelligence API with verified market data, trading signals, sentiment analysis, and fact-checking across 1,061+ tickers. PyPI",
      },
      {
        name: "lse-data",
        url: "https://github.com/londonstrategicedge/lse-data",
        repo: "https://github.com/londonstrategicedge/lse-data",
        tags: ["Python"],
        description:
          "Live ticks over WebSocket plus historical ticks and candles for stocks, FX, crypto, commodities, indices, ETFs and futures, with options chains and greeks, economics series and government bond yields, across 118,000+ datasets. US stocks from 2003, FX from 2009, options from 2014, economics back to 1900. Free, no subscription tiers. PyPI",
      },
      {
        name: "IBrokers",
        url: "https://cran.r-project.org/web/packages/IBrokers/index.html",
        tags: ["R"],
        description:
          "Provides native R access to Interactive Brokers Trader Workstation API.",
      },
      {
        name: "Rblpapi",
        url: "https://github.com/Rblp/Rblpapi",
        repo: "https://github.com/Rblp/Rblpapi",
        tags: ["R"],
        description:
          "An R Interface to 'Bloomberg' is provided via the 'Blp API'.",
      },
      {
        name: "Rbitcoin",
        url: "https://github.com/jangorecki/Rbitcoin",
        repo: "https://github.com/jangorecki/Rbitcoin",
        tags: ["R"],
        description:
          "Unified markets API interface (bitstamp, kraken, btce, bitmarket).",
      },
      {
        name: "GetTDData",
        url: "https://github.com/msperlin/GetTDData",
        repo: "https://github.com/msperlin/GetTDData",
        tags: ["R"],
        description:
          "Downloads and aggregates data for Brazilian government issued bonds directly from the website of Tesouro Direto.",
      },
      {
        name: "GetHFData",
        url: "https://github.com/msperlin/GetHFData",
        repo: "https://github.com/msperlin/GetHFData",
        tags: ["R"],
        description:
          "Downloads and aggregates high frequency trading data for Brazilian instruments directly from Bovespa ftp site.",
      },
      {
        name: "td",
        url: "https://github.com/eddelbuettel/td",
        repo: "https://github.com/eddelbuettel/td",
        tags: ["R"],
        description:
          "Interfaces the 'twelvedata' API for stocks and (digital and standard) currencies.",
      },
      {
        name: "rbcb",
        url: "https://github.com/wilsonfreitas/rbcb",
        repo: "https://github.com/wilsonfreitas/rbcb",
        tags: ["R"],
        description:
          "R interface to Brazilian Central Bank web services.",
      },
      {
        name: "rb3",
        url: "https://github.com/ropensci/rb3",
        repo: "https://github.com/ropensci/rb3",
        tags: ["R"],
        description:
          "A bunch of downloaders and parsers for data delivered from B3.",
      },
      {
        name: "simfinapi",
        url: "https://github.com/matthiasgomolka/simfinapi",
        repo: "https://github.com/matthiasgomolka/simfinapi",
        tags: ["R"],
        description:
          "Makes 'SimFin' data (<https://simfin.com/>) easily accessible in R.",
      },
      {
        name: "tidyfinance",
        url: "https://github.com/tidy-finance/r-tidyfinance",
        repo: "https://github.com/tidy-finance/r-tidyfinance",
        tags: ["R"],
        description:
          "Tidy Finance helper functions to download financial data and process the raw data into a structured Format (tidy data), including.",
      },
      {
        name: "CcyConv.jl",
        url: "https://github.com/bhftbootcamp/CcyConv.jl",
        repo: "https://github.com/bhftbootcamp/CcyConv.jl",
        tags: ["Julia"],
        description:
          "Currency conversion library for Julia.",
      },
      {
        name: "CryptoExchangeAPIs.jl",
        url: "https://github.com/bhftbootcamp/CryptoExchangeAPIs.jl",
        repo: "https://github.com/bhftbootcamp/CryptoExchangeAPIs.jl",
        tags: ["Julia"],
        description:
          "A Julia library for cryptocurrency exchange APIs.",
      },
      {
        name: "MarketData.jl",
        url: "https://github.com/JuliaQuant/MarketData.jl",
        repo: "https://github.com/JuliaQuant/MarketData.jl",
        tags: ["Julia"],
        description:
          "Time series market data.",
      },
      {
        name: "OnlineResamplers.jl",
        url: "https://github.com/femtotrader/OnlineResamplers.jl",
        repo: "https://github.com/femtotrader/OnlineResamplers.jl",
        tags: ["Julia"],
        description:
          "High-performance Julia package for real-time resampling of financial market data.",
      },
      {
        name: "PENDAX",
        url: "https://github.com/CompendiumFi/PENDAX-SDK",
        repo: "https://github.com/CompendiumFi/PENDAX-SDK",
        tags: ["JavaScript"],
        description:
          "Javascript SDK for Trading/Data API and Websockets for FTX, FTXUS, OKX, Bybit, & More.",
      },
      {
        name: "PreReason",
        url: "https://github.com/PreReason/mcp",
        repo: "https://github.com/PreReason/mcp",
        tags: ["JavaScript"],
        description:
          "Pre-analyzed Bitcoin and macro market briefings for AI agents. 17 contexts with trend signals, confidence scores, and regime classification via REST API and MCP.",
      },
      {
        name: "fin-stream",
        url: "https://github.com/Mattbusel/fin-stream",
        repo: "https://github.com/Mattbusel/fin-stream",
        tags: ["Rust"],
        description:
          "Real-time market data streaming in Rust: lock-free SPSC ring buffer, 100K+ ticks/second ingestion, multi-timeframe OHLCV construction, and Lorentz transforms on financial time series.",
      },
      {
        name: "finalytics",
        url: "https://github.com/Nnamdi-sys/finalytics",
        repo: "https://github.com/Nnamdi-sys/finalytics",
        tags: ["Rust"],
        description:
          "A rust library for financial data analysis.",
      },
      {
        name: "Factor Weave",
        url: "https://factorweave.com/",
        repo: "https://github.com/Blazing-Customs/factorweave-tools",
        tags: ["Python", "TypeScript", "R"],
        description:
          "Factor scores, similarity search, and leak-free + survivor-free forward-return labels across equities, ETFs, indices, FX, crypto, and futures; REST + MCP, Python/TypeScript/R SDKs, free tier.",
      },
      {
        name: "Backtesting Arena",
        url: "https://tradingstrategies.work/api",
        repo: "https://github.com/Schoasch/skill-backtesting-arena",
        tags: ["TypeScript"],
        description:
          "REST + MCP API for point-in-time Bitcoin cycle scoring, 22 on-chain series since 2009 (MVRV, NUPL, SOPR, Mayer, Puell), macro-regime composites and look-ahead-aware backtest validation with Deflated-Sharpe-Ratio correction across crypto, stocks, ETFs, commodities and forex. Free tier.",
      },
      {
        name: "EarningsCall",
        url: "https://github.com/EarningsCall/earningscall-python",
        repo: "https://github.com/EarningsCall/earningscall-python",
        tags: ["Python"],
        description:
          "REST API and Python/JavaScript SDK for earnings call transcripts, audio files, and slide decks for 9,000+ public companies. Includes speaker-level data, Q&A segmentation, and earnings calendar.",
      },
      {
        name: "Korean Market Data",
        url: "https://github.com/james-brand/korea-market-data",
        repo: "https://github.com/james-brand/korea-market-data",
        tags: ["Data"],
        description:
          "Daily foreign and institutional net flows for every KOSPI/KOSDAQ common stock plus all 44 KRX sector indices with returns and excess return vs market, in English CSV/JSON under CC BY 4.0 with a Zenodo DOI, rebuilt each trading day.",
      },
      {
        name: "AgentServices",
        url: "https://agentservices.to",
        repo: "https://github.com/vbkotecha/aiservices-api",
        tags: ["Python"],
        description:
          "x402-paid crypto and market data API platform: 54 services, 97 endpoints, 37 MCP tools. Real-time prices, technical indicators, on-chain data, and market intelligence with on-chain USDC payments on Base.",
      },
    ],
  },
  {
    name: "Prediction Markets",
    entries: [
      {
        name: "pmxt",
        url: "https://github.com/pmxt-dev/pmxt",
        repo: "https://github.com/pmxt-dev/pmxt",
        tags: ["Python", "JavaScript"],
        description:
          "The CCXT for prediction markets. A unified API for trading on Polymarket, Kalshi, and more.",
      },
      {
        name: "polymarket-whales",
        url: "https://github.com/al1enjesus/polymarket-whales",
        repo: "https://github.com/al1enjesus/polymarket-whales",
        tags: ["Python"],
        description:
          "Real-time whale trade tracker for Polymarket — terminal alerts + Telegram notifications when large orders hit the book.",
      },
      {
        name: "Polymarket Scanner API",
        url: "https://github.com/vesper-astrena/polymarket-scanner-api",
        repo: "https://github.com/vesper-astrena/polymarket-scanner-api",
        tags: ["Python"],
        description:
          "Real-time arbitrage detection API for Polymarket prediction markets, scanning 12,000+ markets for mispricings.",
      },
      {
        name: "SimpleFunctions",
        url: "https://github.com/spfunctions/simplefunctions-cli",
        repo: "https://github.com/spfunctions/simplefunctions-cli",
        tags: ["JavaScript"],
        description:
          "Prediction market intelligence CLI for Kalshi and Polymarket. Causal thesis models, edge detection, 24/7 orderbook monitoring, what-if scenarios, and trade execution. MCP server for AI agent integration.",
      },
      {
        name: "PolyMind",
        url: "https://polyminds.netlify.app/",
        repo: "https://github.com/samirasadov28-code/PolyMind",
        tags: ["Python"],
        description:
          "Real-time Polymarket trading alerts with multi-AI analysis (Groq, Claude, Gemini). Track whale bets, volume spikes, coordinated wallets, and 12 signal types. Free tier available.",
      },
      {
        name: "prediction-market-maker",
        url: "https://github.com/octavi42/prediction-market-maker",
        repo: "https://github.com/octavi42/prediction-market-maker",
        tags: ["Python"],
        description:
          "Open-source market-making strategy that placed #2 in Paradigm's prediction market challenge, with full strategy evolution and analysis.",
      },
      {
        name: "Oracle3",
        url: "https://github.com/YichengYang-Ethan/oracle3",
        repo: "https://github.com/YichengYang-Ethan/oracle3",
        tags: ["Python"],
        description:
          "Autonomous trading agent for Kalshi, Polymarket, and Solana — Wang Transform pricing (calibrated on 291k resolved contracts) drives eight constraint-based arbitrage strategies and Kelly-sized model trades.",
      },
      {
        name: "marketlens",
        url: "https://github.com/marketlenstrade/marketlens-python",
        repo: "https://github.com/marketlenstrade/marketlens-python",
        tags: ["Python", "MCP"],
        description:
          "Tick-level Polymarket order book history with replay and a backtesting engine simulating queue priority, latency, and slippage.",
      },
      {
        name: "polymarket-bot-lab",
        url: "https://github.com/oraclemangle/polymarket-bot-lab",
        repo: "https://github.com/oraclemangle/polymarket-bot-lab",
        tags: ["Python"],
        description:
          "Open-sourced research lab of 11 candidate Polymarket trading bots (weather, sports, longshot fades, maker, whale-flow) with a shared CLOB/backtest framework, ADR decision log, and honest paper/live results. Companion free dataset: polymarket-canary-tape (300M+ events, CC-BY-4.0).",
      },
      {
        name: "Live Tennis API",
        url: "https://livetennisapi.com",
        repo: "https://github.com/livetennisapi/livetennisapi-mcp",
        tags: ["REST", "WebSocket", "MCP"],
        description:
          "Real-time tennis scores, serving and break-point state, and model win probabilities for pricing tennis event markets, plus H2H, rankings and a 1968-2022 point-by-point archive; free tier.",
      },
      {
        name: "polymm",
        url: "https://github.com/kachence/polymm",
        repo: "https://github.com/kachence/polymm",
        tags: ["Python", "Polymarket"],
        description:
          "Market-making and arbitrage bot for Polymarket sports and esports markets, pricing from de-vigged sportsbook odds.",
      },
    ],
  },
  {
    name: "Calendars & Market Hours",
    entries: [
      {
        name: "exchange_calendars",
        url: "https://github.com/gerrymanoim/exchange_calendars",
        repo: "https://github.com/gerrymanoim/exchange_calendars",
        tags: ["Python"],
        description:
          "Stock Exchange Trading Calendars.",
      },
      {
        name: "bizdays",
        url: "https://github.com/wilsonfreitas/python-bizdays",
        repo: "https://github.com/wilsonfreitas/python-bizdays",
        tags: ["Python"],
        description:
          "Business days calculations and utilities.",
      },
      {
        name: "pandas_market_calendars",
        url: "https://github.com/rsheftel/pandas_market_calendars",
        repo: "https://github.com/rsheftel/pandas_market_calendars",
        tags: ["Python"],
        description:
          "Exchange calendars to use with pandas for trading applications.",
      },
      {
        name: "timeDate",
        url: "https://cran.r-project.org/web/packages/timeDate/index.html",
        tags: ["R"],
        description:
          "Chronological and Calendar Objects.",
      },
      {
        name: "bizdays",
        url: "https://github.com/wilsonfreitas/R-bizdays",
        repo: "https://github.com/wilsonfreitas/R-bizdays",
        tags: ["R"],
        description:
          "Business days calculations and utilities.",
      },
      {
        name: "sifma-holidays",
        url: "https://github.com/moshejs/sifma-holidays",
        repo: "https://github.com/moshejs/sifma-holidays",
        tags: ["TypeScript"],
        description:
          "US bond-market (SIFMA) holidays, early closes, and T+1 settlement-date math; zero dependencies.",
      },
      {
        name: "us-equity-market-calendar",
        url: "https://github.com/moshejs/us-equity-market-calendar",
        repo: "https://github.com/moshejs/us-equity-market-calendar",
        tags: ["TypeScript"],
        description:
          "NYSE/NASDAQ trading calendar: holidays, 1pm early closes, trading-day navigation, and DST-aware is-market-open; zero dependencies.",
      },
      {
        name: "fx-value-date",
        url: "https://github.com/moshejs/fx-value-date",
        repo: "https://github.com/moshejs/fx-value-date",
        tags: ["TypeScript"],
        description:
          "FX spot/forward value-date calculation across two currency holiday calendars, with the USD-lag and end-of-month rules; zero dependencies.",
      },
    ],
  },
  {
    name: "Visualization",
    entries: [
      {
        name: "D-Tale",
        url: "https://github.com/man-group/dtale",
        repo: "https://github.com/man-group/dtale",
        tags: ["Python"],
        description:
          "Visualizer for pandas dataframes and xarray datasets.",
      },
      {
        name: "mplfinance",
        url: "https://github.com/matplotlib/mplfinance",
        repo: "https://github.com/matplotlib/mplfinance",
        tags: ["Python"],
        description:
          "matplotlib utilities for the visualization, and visual analysis, of financial data.",
      },
      {
        name: "finplot",
        url: "https://github.com/highfestiva/finplot",
        repo: "https://github.com/highfestiva/finplot",
        tags: ["Python"],
        description:
          "Performant and effortless finance plotting for Python.",
      },
      {
        name: "finvizfinance",
        url: "https://github.com/lit26/finvizfinance",
        repo: "https://github.com/lit26/finvizfinance",
        tags: ["Python"],
        description:
          "Finviz analysis python library.",
      },
      {
        name: "market-analy",
        url: "https://github.com/maread99/market_analy",
        repo: "https://github.com/maread99/market_analy",
        tags: ["Python"],
        description:
          "Analysis and interactive charting using market-prices and bqplot.",
      },
      {
        name: "QuantInvestStrats",
        url: "https://github.com/ArturSepp/QuantInvestStrats",
        repo: "https://github.com/ArturSepp/QuantInvestStrats",
        tags: ["Python"],
        description:
          "Quantitative Investment Strategies (QIS) package implements Python analytics for visualisation of financial data, performance reporting, analysis of quantitative strategies.",
      },
      {
        name: "LightweightCharts.jl",
        url: "https://github.com/bhftbootcamp/LightweightCharts.jl",
        repo: "https://github.com/bhftbootcamp/LightweightCharts.jl",
        tags: ["Julia"],
        description:
          "Julia wrapper for Lightweight Charts™ by TradingView.",
      },
      {
        name: "QUANTAXIS_Webkit",
        url: "https://github.com/yutiansut/QUANTAXIS_Webkit",
        repo: "https://github.com/yutiansut/QUANTAXIS_Webkit",
        tags: ["JavaScript"],
        description:
          "An awesome visualization center based on quantaxis.",
      },
      {
        name: "dxcharts-lite",
        url: "https://github.com/devexperts/dxcharts-lite",
        repo: "https://github.com/devexperts/dxcharts-lite",
        tags: ["JavaScript"],
        description:
          "Flexible financial charting library based on HTML5 canvas.",
      },
      {
        name: "Exeria Charts",
        url: "https://github.com/efixdata/exeria-charts",
        repo: "https://github.com/efixdata/exeria-charts",
        tags: ["JavaScript"],
        description:
          "High-performance, native Canvas/WebGL financial charting library for self-hosted applications without iframe limits.",
      },
      {
        name: "MyLinedChart",
        url: "https://mylinedchart.com",
        tags: ["Desktop"],
        description:
          "Technical-analysis charting app for Interactive Brokers (IBKR) that exports drawings, notes, indicators and OHLCV as JSON/XLSX/CSV, and exposes chart context to AI agents over MCP.",
      },
    ],
  },
  {
    name: "Excel & Spreadsheet Integration",
    entries: [
      {
        name: "Bilig",
        url: "https://github.com/proompteng/bilig",
        repo: "https://github.com/proompteng/bilig",
        tags: ["TypeScript"],
        description:
          "Formula WorkPaper and XLSX recalculation runtime for Node.js services and agent tools.",
      },
      {
        name: "xlwings",
        url: "https://www.xlwings.org/",
        repo: "https://github.com/xlwings/xlwings",
        tags: ["Python"],
        description:
          "Make Excel fly with Python.",
      },
      {
        name: "openpyxl",
        url: "https://openpyxl.readthedocs.io/en/latest/",
        tags: ["Python"],
        description:
          "Read/Write Excel 2007 xlsx/xlsm files.",
      },
      {
        name: "xlrd",
        url: "https://github.com/python-excel/xlrd",
        repo: "https://github.com/python-excel/xlrd",
        tags: ["Python"],
        description:
          "Library for developers to extract data from Microsoft Excel spreadsheet files.",
      },
      {
        name: "xlsxwriter",
        url: "https://xlsxwriter.readthedocs.io/",
        repo: "https://github.com/jmcnamara/XlsxWriter",
        tags: ["Python"],
        description:
          "Write files in the Excel 2007+ XLSX file format.",
      },
      {
        name: "xlwt",
        url: "https://github.com/python-excel/xlwt",
        repo: "https://github.com/python-excel/xlwt",
        tags: ["Python"],
        description:
          "Library to create spreadsheet files compatible with MS Excel 97/2000/XP/2003 XLS files, on any platform.",
      },
      {
        name: "xlloop",
        url: "http://xlloop.sourceforge.net",
        repo: "https://github.com/poidasmith/xlloop",
        tags: ["Python"],
        description:
          "XLLoop is an open source framework for implementing Excel user-defined functions (UDFs) on a centralised server (a function server).",
      },
      {
        name: "expy",
        url: "http://www.bnikolic.co.uk/expy/expy.html",
        tags: ["Python"],
        description:
          "The ExPy add-in allows easy use of Python directly from within an Microsoft Excel spreadsheet, both to execute arbitrary code and to define new Excel functions.",
      },
      {
        name: "pyxll",
        url: "https://www.pyxll.com",
        tags: ["Python"],
        description:
          "PyXLL is an Excel add-in that enables you to extend Excel using nothing but Python code.",
      },
    ],
  },
  {
    name: "Quant Research Environments",
    entries: [
      {
        name: "Jupyter Quant",
        url: "https://github.com/gnzsnz/jupyter-quant",
        repo: "https://github.com/gnzsnz/jupyter-quant",
        tags: ["Python"],
        description:
          "A dockerized Jupyter quant research environment with preloaded tools for quant analysis, statsmodels, pymc, arch, py_vollib, zipline-reloaded, PyPortfolioOpt, etc.",
      },
    ],
  },
  {
    name: "Cross-Language Frameworks",
    entries: [
      {
        name: "RunMat",
        url: "https://runmat.org",
        repo: "https://github.com/runmat-org/runmat",
        tags: [],
        description:
          "High performance, Open Source, MATLAB syntax runtime.",
      },
      {
        name: "QuantLibRisks",
        url: "https://github.com/auto-differentiation/QuantLib-Risks-Cpp",
        repo: "https://github.com/auto-differentiation/QuantLib-Risks-Cpp",
        tags: [],
        description:
          "Fast risks with QuantLib in C++.",
      },
      {
        name: "XAD",
        url: "https://github.com/auto-differentiation/xad",
        repo: "https://github.com/auto-differentiation/xad",
        tags: [],
        description:
          "Automatic Differentation (AAD) Library.",
      },
      {
        name: "QuantLib",
        url: "https://github.com/lballabio/QuantLib",
        repo: "https://github.com/lballabio/QuantLib",
        tags: [],
        description:
          "The QuantLib project is aimed at providing a comprehensive software framework for quantitative finance.",
        children: [
          {
            name: "QuantLibRisks",
            url: null,
            description: "Fast risks with QuantLib in Python and C++",
          },
          {
            name: "XAD",
            url: null,
            description: "Automatic Differentiation (AAD) Library in Python and C++",
          },
          {
            name: "JQuantLib",
            url: "https://github.com/frgomes/jquantlib",
            description: "Java port.",
          },
          {
            name: "RQuantLib",
            url: "https://github.com/eddelbuettel/rquantlib",
            description: "R port.",
          },
          {
            name: "QuantLibAddin",
            url: "https://www.quantlib.org/quantlibaddin/",
            description: "Excel support.",
          },
          {
            name: "QuantLibXL",
            url: "https://www.quantlib.org/quantlibxl/",
            description: "Excel support.",
          },
          {
            name: "QLNet",
            url: "https://github.com/amaggiulli/qlnet",
            description: ".Net port.",
          },
          {
            name: "PyQL",
            url: "https://github.com/enthought/pyql",
            description: "Python port.",
          },
          {
            name: "QuantLib.jl",
            url: "https://github.com/pazzo83/QuantLib.jl",
            description: "Julia port.",
          },
          {
            name: "QuantLib-Python Documentation",
            url: "https://quantlib-python-docs.readthedocs.io/",
            description: "Documentation for the Python bindings for the QuantLib library.",
          },
        ],
      },
      {
        name: "TA-Lib",
        url: "https://ta-lib.org",
        repo: "https://github.com/TA-Lib/ta-lib",
        tags: [],
        description:
          "perform technical analysis of financial market data.",
        children: [
          {
            name: "ta-lib-python",
            url: "https://github.com/TA-Lib/ta-lib-python",
            description: "",
          },
          {
            name: "ta-lib",
            url: "https://github.com/TA-Lib/ta-lib",
            description: "",
          },
        ],
      },
      {
        name: "RunMat",
        url: "https://github.com/runmat-org/runmat",
        repo: "https://github.com/runmat-org/runmat",
        tags: [],
        description:
          "Rust runtime for MATLAB-syntax array math with automatic CPU/GPU execution and fused kernels for quant simulations.",
      },
      {
        name: "godzilla.dev",
        url: "https://godzilla.dev",
        repo: "https://github.com/godzilla-foundation/godzilla-community",
        tags: ["C++", "Python"],
        description:
          "Open-source framework for crypto quant trading, funding rate arbitrage and ultra-low-latency market making.",
      },
      {
        name: "PineTS",
        url: "https://github.com/LuxAlgo/PineTS",
        repo: "https://github.com/LuxAlgo/PineTS",
        tags: ["TypeScript", "JavaScript", "Pine Script"],
        description:
          "Open-source transpiler and runtime that executes Pine Script logic in Node.js and the browser with 1:1 syntax compatibility, for running indicators and strategies on your own infrastructure.",
      },
    ],
  },
  {
    name: "Reproducing Works, Training & Books",
    entries: [
      {
        name: "Quant Sprint",
        url: "https://lambdia.com/play",
        tags: ["Training", "Interviews"],
        description:
          "Free timed drill of first round quant interview questions on options and the Greeks, two sided quoting, probability and mental arithmetic.",
      },
      {
        name: "Wyckoff Method Course",
        url: "https://arapov.trade/en/freestudying/wyckoff-method",
        tags: [],
        description:
          "Free course on volume analysis and the Wyckoff method: market phases, spring/upthrust, order flow reading.",
      },
      {
        name: "Special-Relativity-in-Financial-Modeling",
        url: "https://github.com/Mattbusel/Special-Relativity-in-Financial-Modeling",
        repo: "https://github.com/Mattbusel/Special-Relativity-in-Financial-Modeling",
        tags: [],
        description:
          "C++20 implementation of special-relativistic geometry applied to OHLCV data: Lorentz factors, spacetime intervals, Christoffel symbols, and geodesic deviation signals from live market data. DOI: 10.5281/zenodo.18639919.",
      },
      {
        name: "Auto-Differentiation Website",
        url: "https://auto-differentiation.github.io/",
        tags: [],
        description:
          "Background and resources on Automatic Differentiation (AD) / Adjoint Algorithmic Differentitation (AAD).",
      },
      {
        name: "Derman Papers",
        url: "https://github.com/MarcosCarreira/DermanPapers",
        repo: "https://github.com/MarcosCarreira/DermanPapers",
        tags: [],
        description:
          "Notebooks that replicate original quantitative finance papers from Emanuel Derman.",
      },
      {
        name: "volatility-trading",
        url: "https://github.com/jasonstrimpel/volatility-trading",
        repo: "https://github.com/jasonstrimpel/volatility-trading",
        tags: [],
        description:
          "A complete set of volatility estimators based on Euan Sinclair's Volatility Trading.",
      },
      {
        name: "quant",
        url: "https://github.com/paulperry/quant",
        repo: "https://github.com/paulperry/quant",
        tags: [],
        description:
          "Quantitative Finance and Algorithmic Trading exhaust; mostly ipython notebooks based on Quantopian, Zipline, or Pandas.",
      },
      {
        name: "fecon235",
        url: "https://github.com/rsvp/fecon235",
        repo: "https://github.com/rsvp/fecon235",
        tags: [],
        description:
          "Open source project for software tools in financial economics. Many jupyter notebook to verify theoretical ideas and practical methods interactively.",
      },
      {
        name: "Quantitative-Notebooks",
        url: "https://github.com/LongOnly/Quantitative-Notebooks",
        repo: "https://github.com/LongOnly/Quantitative-Notebooks",
        tags: [],
        description:
          "Educational notebooks on quantitative finance, algorithmic trading, financial modelling and investment strategy.",
      },
      {
        name: "QuantEcon",
        url: "https://quantecon.org/",
        tags: [],
        description:
          "Lecture series on economics, finance, econometrics and data science; QuantEcon.py, QuantEcon.jl, notebooks.",
      },
      {
        name: "FinanceHub",
        url: "https://github.com/Finance-Hub/FinanceHub",
        repo: "https://github.com/Finance-Hub/FinanceHub",
        tags: [],
        description:
          "Resources for Quantitative Finance.",
      },
      {
        name: "Python_Option_Pricing",
        url: "https://github.com/dedwards25/Python_Option_Pricing",
        repo: "https://github.com/dedwards25/Python_Option_Pricing",
        tags: [],
        description:
          "An library to price financial options written in Python. Includes: Black Scholes, Black 76, Implied Volatility, American, European, Asian, Spread Options.",
      },
      {
        name: "python-training",
        url: "https://github.com/jpmorganchase/python-training",
        repo: "https://github.com/jpmorganchase/python-training",
        tags: [],
        description:
          "J.P. Morgan's Python training for business analysts and traders.",
      },
      {
        name: "Stock_Analysis_For_Quant",
        url: "https://github.com/LastAncientOne/Stock_Analysis_For_Quant",
        repo: "https://github.com/LastAncientOne/Stock_Analysis_For_Quant",
        tags: [],
        description:
          "Different Types of Stock Analysis in Excel, Matlab, Power BI, Python, R, and Tableau.",
      },
      {
        name: "algorithmic-trading-with-python",
        url: "https://github.com/chrisconlan/algorithmic-trading-with-python",
        repo: "https://github.com/chrisconlan/algorithmic-trading-with-python",
        tags: [],
        description:
          "Source code for Algorithmic Trading with Python (2020) by Chris Conlan.",
      },
      {
        name: "MEDIUM_NoteBook",
        url: "https://github.com/cerlymarco/MEDIUM_NoteBook",
        repo: "https://github.com/cerlymarco/MEDIUM_NoteBook",
        tags: [],
        description:
          "Repository containing notebooks of cerlymarco's posts on Medium.",
      },
      {
        name: "QuantFinance",
        url: "https://github.com/PythonCharmers/QuantFinance",
        repo: "https://github.com/PythonCharmers/QuantFinance",
        tags: [],
        description:
          "Training materials in quantitative finance.",
      },
      {
        name: "IPythonScripts",
        url: "https://github.com/mgroncki/IPythonScripts",
        repo: "https://github.com/mgroncki/IPythonScripts",
        tags: [],
        description:
          "Tutorials about Quantitative Finance in Python and QuantLib: Pricing, xVAs, Hedging, Portfolio Optimisation, Machine Learning and Deep Learning.",
      },
      {
        name: "Computational-Finance-Course",
        url: "https://github.com/LechGrzelak/Computational-Finance-Course",
        repo: "https://github.com/LechGrzelak/Computational-Finance-Course",
        tags: [],
        description:
          "Materials for the course of Computational Finance.",
      },
      {
        name: "Machine-Learning-for-Asset-Managers",
        url: "https://github.com/emoen/Machine-Learning-for-Asset-Managers",
        repo: "https://github.com/emoen/Machine-Learning-for-Asset-Managers",
        tags: [],
        description:
          "Implementation of code snippets, exercises and application to live data from Machine Learning for Asset Managers (Elements in Quantitative Finance) written by Prof. Marcos López de Prado.",
      },
      {
        name: "Python-for-Finance-Cookbook",
        url: "https://github.com/PacktPublishing/Python-for-Finance-Cookbook",
        repo: "https://github.com/PacktPublishing/Python-for-Finance-Cookbook",
        tags: [],
        description:
          "Python for Finance Cookbook, published by Packt.",
      },
      {
        name: "modelos_vol_derivativos",
        url: "https://github.com/ysaporito/modelos_vol_derivativos",
        repo: "https://github.com/ysaporito/modelos_vol_derivativos",
        tags: [],
        description:
          "\"Modelos de Volatilidade para Derivativos\" book's Jupyter notebooks.",
      },
      {
        name: "NMOF",
        url: "https://github.com/enricoschumann/NMOF",
        repo: "https://github.com/enricoschumann/NMOF",
        tags: [],
        description:
          "Functions, examples and data from the first and the second edition of \"Numerical Methods and Optimization in Finance\" by M. Gilli, D. Maringer and E. Schumann (2019, ISBN:978-0128150658).",
      },
      {
        name: "py4fi2nd",
        url: "https://github.com/yhilpisch/py4fi2nd",
        repo: "https://github.com/yhilpisch/py4fi2nd",
        tags: [],
        description:
          "Jupyter Notebooks and code for Python for Finance (2nd ed., O'Reilly) by Yves Hilpisch.",
      },
      {
        name: "aiif",
        url: "https://github.com/yhilpisch/aiif",
        repo: "https://github.com/yhilpisch/aiif",
        tags: [],
        description:
          "Jupyter Notebooks and code for the book Artificial Intelligence in Finance (O'Reilly) by Yves Hilpisch.",
      },
      {
        name: "py4at",
        url: "https://github.com/yhilpisch/py4at",
        repo: "https://github.com/yhilpisch/py4at",
        tags: [],
        description:
          "Jupyter Notebooks and code for the book Python for Algorithmic Trading (O'Reilly) by Yves Hilpisch.",
      },
      {
        name: "dawp",
        url: "https://github.com/yhilpisch/dawp",
        repo: "https://github.com/yhilpisch/dawp",
        tags: [],
        description:
          "Jupyter Notebooks and code for Derivatives Analytics with Python (Wiley Finance) by Yves Hilpisch.",
      },
      {
        name: "dx",
        url: "https://github.com/yhilpisch/dx",
        repo: "https://github.com/yhilpisch/dx",
        tags: [],
        description:
          "DX Analytics | Financial and Derivatives Analytics with Python.",
      },
      {
        name: "QuantFinanceBook",
        url: "https://github.com/LechGrzelak/QuantFinanceBook",
        repo: "https://github.com/LechGrzelak/QuantFinanceBook",
        tags: [],
        description:
          "Quantitative Finance book.",
      },
      {
        name: "rough_bergomi",
        url: "https://github.com/ryanmccrickerd/rough_bergomi",
        repo: "https://github.com/ryanmccrickerd/rough_bergomi",
        tags: [],
        description:
          "A Python implementation of the rough Bergomi model.",
      },
      {
        name: "frh-fx",
        url: "https://github.com/ryanmccrickerd/frh-fx",
        repo: "https://github.com/ryanmccrickerd/frh-fx",
        tags: [],
        description:
          "A python implementation of the fast-reversion Heston model of Mechkov for FX purposes.",
      },
      {
        name: "Value Investing Studies",
        url: "https://github.com/euclidjda/value-investing-studies",
        repo: "https://github.com/euclidjda/value-investing-studies",
        tags: [],
        description:
          "A collection of data analysis studies that examine the performance and characteristics of value investing over long periods of time.",
      },
      {
        name: "Machine Learning Asset Management",
        url: "https://github.com/firmai/machine-learning-asset-management",
        repo: "https://github.com/firmai/machine-learning-asset-management",
        tags: [],
        description:
          "Machine Learning in Asset Management (by @firmai).",
      },
      {
        name: "Deep Learning Machine Learning Stock",
        url: "https://github.com/LastAncientOne/Deep-Learning-Machine-Learning-Stock",
        repo: "https://github.com/LastAncientOne/Deep-Learning-Machine-Learning-Stock",
        tags: [],
        description:
          "Deep Learning and Machine Learning stocks represent a promising long-term or short-term opportunity for investors and traders.",
      },
      {
        name: "Technical Analysis and Feature Engineering",
        url: "https://github.com/jo-cho/Technical_Analysis_and_Feature_Engineering",
        repo: "https://github.com/jo-cho/Technical_Analysis_and_Feature_Engineering",
        tags: [],
        description:
          "Feature Engineering and Feature Importance of Machine Learning in Financial Market.",
      },
      {
        name: "Differential Machine Learning and Axes that matter by Brian Huge and Antoine Savine",
        url: "https://github.com/differential-machine-learning/notebooks",
        repo: "https://github.com/differential-machine-learning/notebooks",
        tags: [],
        description:
          "Implement, demonstrate, reproduce and extend the results of the Risk articles 'Differential Machine Learning' (2020) and 'PCA with a Difference' (2021) by Huge and Savine, and cover implementation details left out from the papers.",
      },
      {
        name: "systematictradingexamples",
        url: "https://github.com/robcarver17/systematictradingexamples",
        repo: "https://github.com/robcarver17/systematictradingexamples",
        tags: [],
        description:
          "Examples of code related to book Systematic Trading and blog.",
      },
      {
        name: "pysystemtrade_examples",
        url: "https://github.com/robcarver17/pysystemtrade_examples",
        repo: "https://github.com/robcarver17/pysystemtrade_examples",
        tags: [],
        description:
          "Examples using pysystemtrade for Robert Carver's blog.",
      },
      {
        name: "ML_Finance_Codes",
        url: "https://github.com/mfrdixon/ML_Finance_Codes",
        repo: "https://github.com/mfrdixon/ML_Finance_Codes",
        tags: [],
        description:
          "Machine Learning in Finance: From Theory to Practice Book.",
      },
      {
        name: "cipher-starter",
        url: "https://github.com/cryptomotifs/cipher-starter",
        repo: "https://github.com/cryptomotifs/cipher-starter",
        tags: [],
        description:
          "Solo crypto quant starter kit: 12 playbooks covering trading strategy, risk rails, 3-tier wallet architecture, MEV mitigation, Canadian NI 31-103 compliance, Oracle Cloud Always Free infra, and a 7-day MVP calendar for a Solana signal engine + autonomous trading bot.",
      },
      {
        name: "Hands-On Machine Learning for Algorithmic Trading",
        url: "https://github.com/packtpublishing/hands-on-machine-learning-for-algorithmic-trading",
        repo: "https://github.com/packtpublishing/hands-on-machine-learning-for-algorithmic-trading",
        tags: [],
        description:
          "Hands-On Machine Learning for Algorithmic Trading, published by Packt.",
      },
      {
        name: "financialnoob-misc",
        url: "https://github.com/financialnoob/misc",
        repo: "https://github.com/financialnoob/misc",
        tags: [],
        description:
          "Codes from @financialnoob's posts.",
      },
      {
        name: "MesoSim Options Trading Strategy Library",
        url: "https://github.com/deltaray-io/strategy-library",
        repo: "https://github.com/deltaray-io/strategy-library",
        tags: [],
        description:
          "Free and public Options Trading strategy library for MesoSim.",
      },
      {
        name: "Quant-Finance-With-Python-Code",
        url: "https://github.com/lingyixu/Quant-Finance-With-Python-Code",
        repo: "https://github.com/lingyixu/Quant-Finance-With-Python-Code",
        tags: [],
        description:
          "Repo for code examples in Quantitative Finance with Python by Chris Kelliher.",
      },
      {
        name: "QuantFinanceTraining",
        url: "https://github.com/JoaoJungblut/QuantFinanceTraining",
        repo: "https://github.com/JoaoJungblut/QuantFinanceTraining",
        tags: [],
        description:
          "This repository contains codes that were executed during my training in the CQF (Certificate in Quantitative Finance). The codes are organized by class, facilitating navigation and reference.",
      },
      {
        name: "book_irds3",
        url: "https://github.com/attack68/book_irds3",
        repo: "https://github.com/attack68/book_irds3",
        tags: [],
        description:
          "Code repository for Pricing and Trading Interest Rate Derivatives.",
      },
      {
        name: "Autoencoder-Asset-Pricing-Models",
        url: "https://github.com/RichardS0268/Autoencoder-Asset-Pricing-Models",
        repo: "https://github.com/RichardS0268/Autoencoder-Asset-Pricing-Models",
        tags: [],
        description:
          "Reimplementation of Autoencoder Asset Pricing Models (GKX, 2019).",
      },
      {
        name: "Finance",
        url: "https://github.com/shashankvemuri/Finance",
        repo: "https://github.com/shashankvemuri/Finance",
        tags: [],
        description:
          "150+ quantitative finance Python programs to help you gather, manipulate, and analyze stock market data.",
      },
      {
        name: "101_formulaic_alphas",
        url: "https://github.com/ram-ki/101_formulaic_alphas",
        repo: "https://github.com/ram-ki/101_formulaic_alphas",
        tags: [],
        description:
          "Implementation of 101 formulaic alphas using qstrader.",
      },
      {
        name: "Tidy Finance",
        url: "https://www.tidy-finance.org/",
        tags: [],
        description:
          "An opinionated approach to empirical research in financial economics - a fully transparent, open-source code base in multiple programming languages (Python and R) to enable the reproducible implementation of financial research projects for students and practitioners.",
      },
      {
        name: "RoughVolatilityWorkshop",
        url: "https://github.com/jgatheral/RoughVolatilityWorkshop",
        repo: "https://github.com/jgatheral/RoughVolatilityWorkshop",
        tags: [],
        description:
          "2024 QuantMind's Rough Volatility Workshop lectures.",
      },
      {
        name: "AFML",
        url: "https://github.com/boyboi86/AFML",
        repo: "https://github.com/boyboi86/AFML",
        tags: [],
        description:
          "All the answers for exercises from Advances in Financial Machine Learning by Dr Marco Lopez de Parodo.",
      },
      {
        name: "AlgoTradingLib",
        url: "https://github.com/usdaud/algotradinglib.github.io",
        repo: "https://github.com/usdaud/algotradinglib.github.io",
        tags: [],
        description:
          "A catalog of algorithmic trading libraries, frameworks, strategies, and educational materials.",
      },
      {
        name: "Portfolio Optimization Book",
        url: "https://portfoliooptimizationbook.com/",
        repo: "https://github.com/dppalomar/pob",
        tags: [],
        description:
          "Prof. Daniel Palomar's Portfolio Optimization Book.",
      },
      {
        name: "direct_vola",
        url: "https://github.com/wol-fi/direct_vola",
        repo: "https://github.com/wol-fi/direct_vola",
        tags: ["Python", "R"],
        description:
          "Demo code for direct Black-Scholes implied-volatility calculation from normalized call prices via the inverse-Gaussian quantile representation.",
      },
      {
        name: "TradeMux Snippets",
        url: "https://github.com/KVignesh122/trademux-examples",
        repo: "https://github.com/KVignesh122/trademux-examples",
        tags: ["Python"],
        description:
          "Code snippets for Metatrader (MT5) forex/CFD trading and data retrieval via trademux API client.",
      },
    ],
  },
  {
    name: "Commercial & Proprietary Services",
    entries: [
      {
        name: "Prop Firm Risk Calculator",
        url: "https://prop-firm-risk-calculator.vercel.app",
        tags: [],
        description:
          "Free web app for position sizing, stop-loss and max-drawdown on funded accounts, with real tick/pip values for futures, forex, crypto and gold.",
      },
      {
        name: "AlphaForge",
        url: "https://alforgelabs.com",
        repo: "https://github.com/alforge-labs/alpha-forge-mcp",
        tags: ["Python"],
        description:
          "Local-first agent-native quant CLI with Optuna TPE optimization, walk-forward testing, anti-overfitting guards, and TradingView Pine v6 code generation. Free trial available.",
      },
      {
        name: "TradeMux",
        url: "https://trademux.io",
        tags: [],
        description:
          "Unified forex trading API gateway to Metatrader (MT4/MT5), Oanda and cTrader.",
      },
      {
        name: "Chartscout",
        url: "https://chartscout.io",
        tags: [],
        description:
          "Real-time cryptocurrency chart pattern detection with automated alerts across multiple exchanges.",
      },
      {
        name: "DayTradingBench",
        url: "https://daytradingbench.com",
        tags: [],
        description:
          "Live autonomous benchmark that evaluates LLM trading performance on DAX and Nasdaq indices using identical strategies and real-time market data. API access available.",
      },
      {
        name: "invinoveritas/review",
        url: "https://github.com/trustless-ai/agent-contracts-examples",
        repo: "https://github.com/trustless-ai/agent-contracts-examples",
        tags: ["Python"],
        description:
          "Pre-execution governance gate for AI trading agents: a capital-scale-aware advisory verdict (approve / approve_with_concerns / reject) before an order is placed, via MCP server, REST, x402 (USDC), or Lightning pay-per-call. Dogfooded by a live Hyperliquid bot; verdicts are signed and recomputable against a public ledger. API: https://api.babyblueviper.com",
      },
      {
        name: "CoinTester",
        url: "https://cointester.io",
        tags: [],
        description:
          "No-code crypto backtesting platform with 100+ indicators, AI sentiment signals, and 5+ years of historical data across 1,000+ trading pairs.",
      },
      {
        name: "FinSignals",
        url: "https://finsignals.ai",
        tags: ["Python"],
        description:
          "Reddit-tuned NLP API classifying financial posts across 7 dimensions: sentiment, directionality, quality, post type, relevance score, author confidence, and sarcasm. Free tier available.",
      },
      {
        name: "goMacro.ai",
        url: "https://gomacro.ai",
        tags: [],
        description:
          "AI-powered economic calendar with institutional-grade insights, bull/bear/base case scenario planning for NFP, CPI, PPI and other macro data releases.",
      },
      {
        name: "StockAInsights",
        url: "https://stockainsights.com",
        tags: [],
        description:
          "AI-extracted financial statements API covering SEC filings including foreign filers (20-F, 6-K, 40-F), normalized quarterly and annual data from 2014+.",
      },
      {
        name: "StockVektor",
        url: "https://stockvektor.com",
        tags: [],
        description:
          "Free stock research web app for ~1,300 US stocks with explainable quality scores (Piotroski F-Score, Altman Z-Score, Beneish M-Score, ROIC, EV/EBIT) computed from SEC EDGAR data, sector-relative metrics, insider buying clusters, 13F super-investor overlap, and activist filing (Schedule 13D/G) tracking.",
      },
      {
        name: "bolsai",
        url: "https://usebolsai.com",
        tags: [],
        description:
          "REST API and MCP server for Brazilian stock market data (B3). Covers 350+ stocks, 400+ FIIs with fundamentals (27+ indicators), dividends, historical prices, financials, and macro indicators sourced from B3, CVM, and BCB.",
      },
      {
        name: "brapi.dev",
        url: "https://brapi.dev/",
        tags: [],
        description:
          "Brazilian stock market data API for B3/Bovespa quotes, historical OHLCV, dividends, and fundamentals.",
      },
      {
        name: "Teses da Bolsa",
        url: "https://tesesdabolsa.com",
        tags: [],
        description:
          "Free web app for Brazilian stock and FII fundamentalist analysis on B3. Covers 350+ stocks and 400+ FIIs with 27+ indicators (P/L, DY, ROE, P/VP), 40+ years of historical data, CVM financial statements, dividend history, fair value models, and head-to-head comparisons.",
      },
      {
        name: "13F Insight",
        url: "https://13finsight.com/",
        tags: [],
        description:
          "Track institutional investor 13F holdings with AI-powered analysis, position change alerts, and filing summaries.",
      },
      {
        name: "PortfolioSavvy",
        url: "https://portfoliosavvy.com/",
        tags: [],
        description:
          "Public SEC ownership research web app for exploring 13F portfolios, insider activity, Schedule 13D/G filings, company facts, and latest filing workflows.",
      },
      {
        name: "Earnings Feed",
        url: "https://earningsfeed.com/api",
        tags: [],
        description:
          "Real-time SEC filings, insider trades, and institutional holdings API.",
      },
      {
        name: "EDGAR Events",
        url: "https://edgarevents.com",
        tags: ["REST"],
        description:
          "SEC filing events as typed JSON: 8-K item codes with materiality flags, SC 13D/13G activist stakes (holder, target, percent of class), merger forms, and S-1/424B IPO filings, polled over REST or pushed via HMAC-signed webhooks, sourced from data.sec.gov.",
      },
      {
        name: "Financial Data",
        url: "https://financialdata.net/",
        tags: [],
        description:
          "Stock Market and Financial Data API.",
      },
      {
        name: "Filings Flow",
        url: "https://filingsflow.com",
        tags: [],
        description:
          "Free SEC 13F research web app covering 11,700+ institutional managers and 208,000+ filings from 2019 onward. Quarter-over-quarter position changes with share-based thresholds, confidential-treatment reveals badged, per-filing links to the EDGAR source document, and Excel export on every table. No account required.",
      },
      {
        name: "Frostbyte",
        url: "https://agent-gateway-kappa.vercel.app",
        tags: [],
        description:
          "Real-time crypto prices for 500+ tokens via REST API with free tier, DeFi swap routing and portfolio tracking.",
      },
      {
        name: "SaxoOpenAPI",
        url: "https://www.developer.saxo/",
        tags: [],
        description:
          "Saxo Bank financial data API.",
      },
      {
        name: "RTPR",
        url: "https://rtpr.io",
        tags: [],
        description:
          "Real-time press release API delivering news from Business Wire, PR Newswire, and GlobeNewswire with sub-500ms latency. REST and WebSocket APIs for financial applications. Python and Node.js SDKs available.",
      },
      {
        name: "Nasdaq Data Link",
        url: "https://data.nasdaq.com/tools/full-list",
        tags: [],
        description:
          "Financial data API with support for R, Python, Excel, Ruby, and many other languages (formerly Quandl).",
      },
      {
        name: "Portfolio Optimizer",
        url: "https://portfoliooptimizer.io/",
        tags: [],
        description:
          "Portfolio Optimizer is a Web API for portfolio analysis and optimization.",
      },
      {
        name: "Reddit WallstreetBets API",
        url: "https://tradestie.com/apps/reddit/api/",
        tags: [],
        description:
          "Provides daily top 50 stocks from reddit (subreddit) Wallstreetbets and their sentiments via the API.",
      },
      {
        name: "System R",
        url: "https://systemr.ai/",
        tags: [],
        description:
          "AI-native risk intelligence API for trading agents. Position sizing, risk validation, and system health in one call.",
      },
      {
        name: "Telonex",
        url: "https://telonex.io",
        tags: [],
        description:
          "Tick-level prediction market data (trades, quotes, orderbooks, on-chain fills) via REST API and Python SDK.",
      },
      {
        name: "ValueRay",
        url: "https://www.valueray.com/api",
        tags: [],
        description:
          "Technical, quantitative and sentiment data for stocks and ETFs with risk metrics, peer percentiles and market regime signals. Optimized for AI/LLM agents.",
      },
      {
        name: "VertData",
        url: "https://vertdata.com",
        tags: [],
        description:
          "Institutional-grade financial intelligence platform. Track 43K+ congressional trades (STOCK Act), SEC insider Form 4 filings, 25 superinvestor 13F portfolios, CFTC futures positioning, ARK ETF holdings, and short interest — all scored by AI for signal strength.",
      },
      {
        name: "KeepRule",
        url: "https://keeprule.com/",
        tags: [],
        description:
          "Curated library of decision-making principles and investment wisdom from masters like Buffett and Munger, featuring mental models for better investment thinking.",
      },
      {
        name: "Agent Toolbelt",
        url: "https://www.agenttoolbelt.live",
        tags: [],
        description:
          "AI stock-research API returning structured analysis (investment thesis, valuation verdict, insider-signal read, earnings, bull-vs-bear, moat, watchlist ranking) for US equities from Polygon/Finnhub/FMP data. Optimized for LLM agents; free tier.",
      },
      {
        name: "ML-Quant",
        url: "https://www.ml-quant.com/",
        tags: [],
        description:
          "Top Quant resources like ArXiv (sanity), SSRN, RePec, Journals, Podcasts, Videos, and Blogs.",
      },
      {
        name: "RealMarketAPI",
        url: "https://realmarketapi.com/",
        tags: [],
        description:
          "Provides ultra-low latency market data for gold, forex, crypto, and stocks via REST, WebSocket, and MCP—built for speed, reliability, and scale.",
      },
      {
        name: "Probalytics",
        url: "https://probalytics.io",
        tags: [],
        description:
          "Prediction market data infrastructure for Polymarket and Kalshi, with REST API, ClickHouse SQL access, 200–500M orderbook snapshots/day at 1ms resolution, and Parquet bulk exports.",
      },
      {
        name: "Sharpe",
        url: "https://www.sharpe.ai/",
        tags: [],
        description:
          "AI-driven crypto trading intelligence terminal for derivatives positioning, DEX flow, on-chain risk, narrative rotation, token discovery, and agent-ready market data.",
      },
      {
        name: "Webb Database",
        url: "https://webb-database.com/",
        tags: [],
        description:
          "Aggregates public financial data from HKEX, the SFC, the Hong Law Society, UK Companies House and other sources, has searchable datasets on listed companies, many in machine-readable formats.",
      },
      {
        name: "GitDealFlow",
        url: "https://gitdealflow.com",
        tags: [],
        description:
          "Alternative-data signal platform ranking early-stage private companies by GitHub stars-per-day, hiring velocity, and package-registry adoption. Free weekly signal report, Chrome extension overlay on Crunchbase/AngelList, and MCP server on npm for LLM agent access.",
      },
      {
        name: "Clear Street API",
        url: "https://docs.clearstreet.com/?utm_source=github&utm_medium=developer&utm_campaign=api_listings&utm_content=awesome_quant",
        tags: [],
        description:
          "REST API for US equities & options: reference & fundamental data, multi-year financial statements, corporate events, analyst consensus, a screener, and order execution.",
      },
      {
        name: "Finterm",
        url: "https://finterm.xyz",
        tags: ["TypeScript"],
        description:
          "Browser-based, keyboard-first financial terminal. No public GitHub repo (closed source).",
      },
      {
        name: "Coinugget",
        url: "https://coinugget.com",
        tags: [],
        description:
          "Real-time RSI signals, price action, and volume spikes dashboard across multiple exchanges. Free, no sign-up required.",
      },
      {
        name: "The Stall",
        url: "https://the-stall.intuitek.ai",
        repo: "https://github.com/thebrierfox/the-stall",
        tags: ["JavaScript"],
        description:
          "277 pay-per-call tools via MCP: US stocks, crypto, DeFi analytics, Polymarket prediction markets, macro data, and sanctions screening. USDC on Base. No API key required.",
      },
      {
        name: "Stingray",
        url: "https://stingray.fi/",
        tags: [],
        description:
          "Trading strategy builder that turns plain-English market ideas into inspectable rules, backtests them against historical data, and monitors matching live conditions.",
      },
      {
        name: "NeuPortal",
        url: "https://neuportal.ai",
        tags: [],
        description:
          "AI forecasting-accountability lab: every forecast is locked pre-event, Bitcoin-timestamped (OpenTimestamps), and Brier-scored against prediction markets in public.",
      },
      {
        name: "AlphaAssay",
        url: "https://alphaassay.com",
        repo: "https://github.com/alphaassay/mcp",
        tags: ["REST"],
        description:
          "Independent statistical assay office for trading signals and backtests: deflated Sharpe with cumulative trial accounting, probability of backtest overfitting (PBO/CPCV), leakage forensics, placebo tests against matched synthetic null worlds, and pre-registration with Merkle-anchored timestamps — deterministic, Ed25519-signed verdicts anyone can replay. Free demo; hosted API and MCP server. Methodology audit, not investment advice.",
      },
      {
        name: "Market Posture Daily",
        url: "https://marketpd.com",
        tags: [],
        description:
          "Daily trend, regime, momentum and relative-strength data for ~90 crypto assets and US stocks/ETFs, with a cointegration pair screener. Free terminal + JSON API.",
      },
      {
        name: "Honest Backtest",
        url: "https://whop.com/honest-backtest",
        tags: [],
        description:
          "Independent manual code audits of trading bots and their backtests: catches unmodeled commission/slippage, signal-vs-fill price drift, and other gaps between backtested and live results.",
      },
      {
        name: "StreamXLS",
        url: "https://streamxls.com",
        tags: [],
        description:
          "Commercial Excel RTD server for the Interactive Brokers TWS API, streaming market data, account values, positions, and orders into Excel formulas on Windows.",
      },
      {
        name: "AtlasYield",
        url: "https://atlasyield.club",
        repo: "https://github.com/gveshk/atlasyield-score-history",
        tags: [],
        description:
          "Independent rating and allocation layer for on-chain yield: scores every DeFi vault 0-100 across 16 factors, with a public read-only scores API.",
      },
      {
        name: "Katana",
        url: "https://katanascreener.com",
        tags: [],
        description:
          "Free Japan stock screener built on EDINET filings. 160+ fundamentals, custom formula metrics, Graham/Piotroski/Kiyohara presets. No sign-up.",
      },
      {
        name: "Disclosed Capitol",
        url: "https://www.disclosedcapitol.com/data-files/api",
        tags: [],
        description:
          "US congressional and executive-branch stock trade disclosures API. STOCK Act filings plus OGE executive data (~6,743 transactions across 106 officials), with trade-level returns and alpha. Free tier: 500 credits, no card.",
      },
      {
        name: "Wealthville",
        url: "https://wealthville.net",
        repo: "https://github.com/amitesh-m/wealthville-integrations",
        tags: ["REST", "MCP"],
        description:
          "Liquidity-pool scoring for DeFi market making: a 0-100 score and an Enter/Hold/Exit/Reduce/Avoid verdict, with confidence calibrated per protocol, across ~68,800 Solana pools (Meteora DLMM, Orca Whirlpool, Raydium AMM/CLMM/CPMM) and 575 EVM pools on Ethereum, Arbitrum, Base, Optimism, Polygon and BSC. Outcomes are graded after impermanent loss and published as a miss-inclusive 30-day track record. Free keyless API, OpenAPI spec, and a hosted MCP server.",
      },
    ],
  },
  {
    name: "Related Lists",
    entries: [
      {
        name: "awesome-sec-filings",
        url: "https://github.com/vibeyclaw/awesome-sec-filings",
        repo: "https://github.com/vibeyclaw/awesome-sec-filings",
        tags: [],
        description:
          "A curated list of tools, data sources, libraries, and resources for working with SEC filings (13F, 10-K, 10-Q, 8-K).",
      },
      {
        name: "CONVEXFI",
        url: "https://github.com/convexfi",
        repo: "https://github.com/convexfi",
        tags: [],
        description:
          "Official GitHub organization for the convex research group at the Hong Kong University of Science and Technology (HKUST).",
      },
    ],
  },
];

/** Every resource, flattened, with its category attached. */
export const ALL_RESOURCES: (QuantResource & { category: string })[] =
  AWESOME_QUANT.flatMap((cat) =>
    cat.entries.map((entry) => ({ ...entry, category: cat.name })),
  );

/** Tag → number of resources carrying it, most common first. */
export const TAG_COUNTS: [string, number][] = (() => {
  const counts = new Map<string, number>();
  for (const resource of ALL_RESOURCES) {
    for (const tag of resource.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
})();

/** Tags common enough to earn a filter chip; the rest live behind search. */
export const PRIMARY_TAGS: string[] = TAG_COUNTS.filter(
  ([, count]) => count >= 5,
).map(([tag]) => tag);
