const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs-extra");

let url = "https://bulletin.du.edu/undergraduate/coursedescriptions/comp/";

async function scrapeCourses() {
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        
        let courses = [];

        $(".courseblock").each((_, element) => {
            const courseTitleElement = $(element).find(".courseblocktitle");
            const courseDescElement = $(element).find(".courseblockdesc");

            if (!courseTitleElement.length || !courseDescElement.length) return;

            const courseText = courseTitleElement.text().trim();
            const courseDesc = courseDescElement.text().trim();

             // Extract Course Code (COMP-3XXX format only)
            const courseMatch = courseText.match(/COMP\s?(3\d{3})/);
            if (!courseMatch) return; // Ignore if not 3000-level

            const courseCode = `COMP-${courseMatch[1]}`;
            const title = courseText.replace(courseMatch[0], "").trim();

            // Check if prerequisites exist (usually mentioned in the description)
            const hasPrerequisites = /Prerequisite|Prerequisites|Corequisite/i.test(courseDesc);

            if (!hasPrerequisites) {
                courses.push({ course: courseCode, title });
            }
        });

        // Ensure the results directory exists
        await fs.ensureDir("results");

        // Write to JSON file
        await fs.writeJson("results/bulletin.json", { courses }, { spaces: 2 });

        console.log("Scraping completed. Data saved in results/bulletin.json");

    } catch (error) {
        console.error("Error scraping data:", error);
    }
}

// scrapeCourses();

// API URL for live stats
url = "https://denverpioneers.com/services/responsive-calendar.ashx?type=month&sport=0&location=all&date=3%2F1%2F2025+12%3A00%3A00+AM";

async function scrapeEvents() {
    try {
        const response = await axios.get(url);
        const data = response.data; // API response

        if (!data || !Array.isArray(data)) {
            console.log("No events found in API response.");
            return;
        }

        let events = [];

        data.forEach(day => {
            if (day.events) {
                day.events.forEach(event => {
                    events.push({
                        duTeam: "Denver Pioneers",
                        opponent: event.opponent ? event.opponent.title : "Unknown Opponent",
                        date: event.date.split("T")[0] // Extract only the date
                    });
                });
            }
        });

        // Ensure the results directory exists
        await fs.ensureDir("results");

        // Write extracted events to JSON file
        await fs.writeJson("results/athletic_events.json", { events }, { spaces: 2 });

        console.log("Scraping completed. Data saved in results/athletic_events.json");

    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

// Run the scraper
// scrapeEvents();
const calendarUrl = "https://www.du.edu/calendar";

async function fetchEventDetails(eventUrl) {
    try {
        const { data } = await axios.get(eventUrl);
        const $ = cheerio.load(data);
        const description = $(".description").text().trim() || "No description available";
        return description;
    } catch (error) {
        console.error(`Error fetching event details from ${eventUrl}:`, error.message);
        return "No description available";
    }
}

async function scrapeDUCalendar() {
    try {
        const { data } = await axios.get(calendarUrl);
        const $ = cheerio.load(data);

        let eventPromises = [];

        $(".event-card").each((_, element) => {
            const title = $(element).find("h3").text().trim();
            const date = $(element).find("p:first").text().trim();
            const time = $(element).find(".icon-du-clock").parent().text().trim();
            const location = $(element).find(".icon-du-location").parent().text().trim();
            let detailsUrl = $(element).attr("href");

            if (detailsUrl) {
                if (!detailsUrl.startsWith("http")) {
                    detailsUrl = `https://www.du.edu${detailsUrl}`;
                }
            } else {
                detailsUrl = "No URL available";
            }

            eventPromises.push(
                fetchEventDetails(detailsUrl).then(description => ({
                    title,
                    date,
                    time,
                    location,
                    description
                }))
            );
        });

        const events = await Promise.all(eventPromises);

        if (events.length === 0) {
            console.log("⚠️ No events found. Check the selector or website structure.");
        }

        await fs.ensureDir("results");
        await fs.writeJson("results/calendar_events.json", { events }, { spaces: 2 });

        console.log("Scraping completed. Data saved in results/calendar_events.json");

    } catch (error) {
        console.error("Error scraping calendar:", error.message);
    }
}

scrapeDUCalendar();