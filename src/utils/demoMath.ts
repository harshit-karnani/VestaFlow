export const getDemoStats = (totalAmount: number, totalMonths: number, startTime: number, currentBlockTime: number) => {
  // Use blockchain time instead of skewed local clock
  const now = currentBlockTime || Math.floor(Date.now() / 1000);
  const elapsedSeconds = Math.max(0, now - startTime);
  
  // For demo: Total minutes in the vesting period
  const totalMinutes = totalMonths * 30 * 24 * 60;
  
  // Cap elapsed minutes at total minutes so it doesn't over-claim
  const elapsedMinutes = Math.min(Math.floor(elapsedSeconds / 60), totalMinutes);
  
  const amountPerMinute = totalMinutes > 0 ? totalAmount / totalMinutes : 0;

  return {
    claimable: (elapsedMinutes * amountPerMinute).toFixed(4),
    secondsToNextMinute: elapsedSeconds >= (totalMinutes * 60) ? 0 : 60 - (elapsedSeconds % 60),
    progressPercent: (elapsedMinutes % 60) / 60 * 100, // For the 60-segment UI
    currentMinuteOfHour: elapsedMinutes % 60,
  };
};
