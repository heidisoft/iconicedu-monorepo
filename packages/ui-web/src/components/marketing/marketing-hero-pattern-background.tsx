export function MarketingHeroPatternBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
      data-testid="hero-background"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-100/65 via-transparent to-emerald-50/50 dark:from-emerald-900/35 dark:to-emerald-950/30" />

      <div
        className="absolute right-[-4rem] top-[-3rem] h-[90%] w-[82%]"
        data-testid="hero-pattern-cluster"
      >
        <div className="absolute -left-[72%] top-[0%] grid grid-cols-3 gap-2 md:left-[0%]">
          <div className="h-[4.5rem] w-[4.5rem] rounded-full bg-emerald-500/90" />
          <div className="h-[4.5rem] w-[4.5rem] rounded-full bg-emerald-300/90" />
          <div className="h-[4.5rem] w-[4.5rem] rounded-full bg-emerald-200/90" />
          <div className="h-[4.5rem] w-[4.5rem] rounded-full bg-emerald-300/90" />
          <div className="h-[4.5rem] w-[4.5rem] rounded-full bg-slate-300/90 dark:bg-slate-600/70" />
          <div className="h-[4.5rem] w-[4.5rem] rounded-tl-[4rem] rounded-br-[4rem] bg-emerald-500/85" />
        </div>

        <div className="absolute right-[1%] top-[3%] h-40 w-40 rounded-full border-[26px] border-emerald-500/90 dark:border-emerald-400/75">
          <div className="absolute inset-6 rounded-full bg-slate-800/90 dark:bg-slate-900/90" />
        </div>

        {/* <div className="absolute right-[0%] top-[22%] h-64 w-64 bg-[conic-gradient(from_225deg,rgba(51,65,85,0.94)_0_50%,rgba(16,185,129,0.86)_50%_100%)] dark:bg-[conic-gradient(from_225deg,rgba(15,23,42,0.96)_0_50%,rgba(5,150,105,0.78)_50%_100%)]" /> */}
        <div className="absolute right-[0%] top-[30%] h-32 w-32 rotate-45 border-[18px] border-slate-200/85 dark:border-slate-700/70" />

        {/* <div className="absolute right-[2%] top-[46%] h-52 w-52 rounded-full border-[38px] border-emerald-500/86 dark:border-emerald-500/74">
          <div className="absolute inset-8 rounded-full bg-slate-800/90 dark:bg-slate-900/90" />
        </div> */}

        {/* <div className="absolute left-[24%] top-[48%] h-44 w-44 rounded-full bg-slate-800/88 dark:bg-slate-900/88" />
        <div className="absolute left-[24%] top-[48%] h-44 w-44 bg-[radial-gradient(circle_at_50%_0%,rgba(167,243,208,0.95)_0_40%,transparent_41%),radial-gradient(circle_at_100%_50%,rgba(16,185,129,0.92)_0_40%,transparent_41%),radial-gradient(circle_at_50%_100%,rgba(167,243,208,0.95)_0_40%,transparent_41%),radial-gradient(circle_at_0%_50%,rgba(16,185,129,0.92)_0_40%,transparent_41%)]" /> */}

        {/* <div className="absolute left-[18%] top-[72%] h-36 w-36 rotate-45 bg-slate-800/90 dark:bg-slate-900/90">
          <div className="absolute inset-[26%] -rotate-45 bg-emerald-500/90 dark:bg-emerald-500/80" />
        </div> */}

        {/* <div className="absolute left-[44%] top-[68%] h-48 w-48 bg-[conic-gradient(from_225deg,rgba(51,65,85,0.94)_0_50%,rgba(16,185,129,0.86)_50%_100%)] dark:bg-[conic-gradient(from_225deg,rgba(15,23,42,0.96)_0_50%,rgba(5,150,105,0.78)_50%_100%)]" />
        <div className="absolute left-[60%] top-[68%] h-48 w-48 rounded-full border-[34px] border-slate-300/76 dark:border-slate-700/66">
          <div className="absolute inset-7 rounded-full bg-slate-800/90 dark:bg-slate-900/90" />
        </div> */}

        {/* <div className="absolute left-[80%] top-[68%] h-[8.5rem] w-[8.5rem] bg-slate-800/90 dark:bg-slate-900/90">
          <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-emerald-500/90 dark:bg-emerald-500/80" />
          <div className="absolute left-0 top-0 h-12 w-12 rounded-br-full bg-emerald-200/95 dark:bg-emerald-300/78" />
          <div className="absolute right-0 top-0 h-12 w-12 rounded-bl-full bg-emerald-200/95 dark:bg-emerald-300/78" />
          <div className="absolute bottom-0 left-0 h-12 w-12 rounded-tr-full bg-emerald-200/95 dark:bg-emerald-300/78" />
          <div className="absolute bottom-0 right-0 h-12 w-12 rounded-tl-full bg-emerald-200/95 dark:bg-emerald-300/78" />
        </div> */}
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(71,85,105,0.1)_1.5px,transparent_1.5px),linear-gradient(to_bottom,rgba(71,85,105,0.2)_1.5px,transparent_1.5px)] bg-[size:92px_92px] [mask-image:radial-gradient(circle_at_78%_18%,black,transparent_78%)] dark:bg-[linear-gradient(to_right,rgba(100,116,139,0.5)_1.5px,transparent_1.5px),linear-gradient(to_bottom,rgba(100,116,139,0.5)_1.5px,transparent_1.5px)]" />
    </div>
  );
}
