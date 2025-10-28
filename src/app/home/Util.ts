export class Util {
  static isLessThanDaysAgo(dateString: string, days = 3) {
    const parsedDate = new Date(dateString + 'T00:00:00');
    if (isNaN(parsedDate.getTime())) {
      throw new Error("Invalid date format. Expected 'YYYY-MM-DD'");
    }
    const diffMs = Date.now() - parsedDate.getTime();
    const hoursDiff = diffMs / (1000 * 60 * 60); // 1000 ms * 60 sec * 60 min
    // True if date is in the past and within X days ago
    return diffMs > 0 && hoursDiff < days * 24;
  }
}