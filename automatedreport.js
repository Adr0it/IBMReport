/* 
Required packages: 
puppeteer - allows to get website's HTML
checker - runs IBM's accessibility scan 
aceconfig - configures IBM accessibility scan
json2xls - creates Excel files from JSON
fs - manipulate IBM report
path - used for removing files in Temp folder
child_process - run R scripts
sitemapURLScraper - used to run on urls in the site
*/

const puppeteer = require('puppeteer');
const checker = require('accessibility-checker');
const aceconfig = require('./aceconfig.js');
const json2xlsx = require('json2xls');
const fs = require('fs');
const fsExtra = require('fs-extra');
const { exec } = require('child_process');
const siteMap = require('sitemap-crawler');


async function getSiteMap(url) {
    return new Promise((resolve, reject) => {
        siteMap(url, (err, res) => {
            if (err) {
                console.error('Error getting sitemap:', err);
                reject(err);
            } else {
                console.log('siteMap:', res);
                resolve(res);
            }
        });
    });
}

async function fetchPage(browser, url) {
    try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        return page;
    } catch (error) {
        console.error('Error fetching HTML: ', error);
        throw error;
    }
}

async function JSONtoXLSX(report, idx, output) {
    try {
        var json = report;
        var data_sheet = [];
        for (var i = 0; i < json.results.length; i++) {
            var issueID = i + 1;
            var pageURL = json.summary["URL"];
            var scanID = json["scanID"];
            var policies = json.summary["policies"];
            var category = json.results[i]["category"];
            var level = json.results[i]["level"];
            var message = json.results[i]["message"];
            var ruleID = json.results[i]["ruleId"];
            var snippet = json.results[i]["snippet"];
            var dom = json.results[i]["path"]["dom"];
            var help = json.results[i]["help"];

            var entry = {
                issueID: issueID,
                pageURL: pageURL,
                scanID: scanID,
                policies: policies,
                category: category,
                level: level,
                message: message,
                ruleID: ruleID,
                snippet: snippet,
                dom: dom,
                help: help
            }
            data_sheet.push(entry);
        }
        var xlsx = json2xlsx(data_sheet);
        if (idx != -1)
            fs.writeFileSync(`${output}\\temp\\out${idx}.xlsx`, xlsx, `binary`);
        else
            fs.writeFileSync(`${output}\\temp\\out.xlsx`, xlsx, `binary`);
    } catch (error) {
        console.error("Error when converting JSON to XLSX: ", error);
    }
}

async function createIBMReport(page, idx, output) {
    try {
        if (idx != -1) {
            const response = await checker.getCompliance(content = page, label = `out${idx}`);
            return response;
        } else {
            const response = await checker.getCompliance(content = page, label = `out`);
            return response;
        }
    } catch (error) {
        console.error('Error creating IBM Report: ', error);
        throw error;
    }
}

async function GenerateVisualReport(url, idx, output) {
    const Rscript = `"C:/Program Files/R/R-4.3.2/bin/Rscript.exe"`;
    let cmd;
    if (idx !== -1)
        cmd = `${Rscript} ./Rfiles/AutomatedReportHelper.R ${url} ${output} ${idx}`;
    else
        cmd = `${Rscript} ./Rfiles/AutomatedReportHelper.R ${url} ${output} ${idx}`;

    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }
        //console.log(`stdout: ${stdout}`);
        //console.error(`stderr: ${stderr}`);
    });
}

const asyncWait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function checkFile(file, attempts = 1, maxAttempts = 5) {  
    for (let attempt = attempts; attempt <= maxAttempts; attempt++) {
      try {
        await fs.promises.access(file, fs.constants.F_OK);
        //console.log(`File exists: ${file}. Attempt: ${attempt}`);
        return true;
      } catch (err) {
        //console.log(`File does not exist. Attempt: ${attempt}`);
        if (attempt < maxAttempts) await asyncWait(5000);
      }
    }
    return false;
}

async function DeleteFolder(idx, output) {
    const dir = `${output}\\temp`;
    var report;
    if (idx != -1)
        report = `${output}\\AutomatedReport${idx}.html`;
    else
        report = `${output}\\AutomatedReport.html`;

    var reportExists = await checkFile(report);
    if (reportExists) {
        fs.rm(dir, {recursive: true, force: true}, (err) => {});
        //console.log(`Folder removed: ${dir}`);
    }
}

async function runReport(url, idx, output, keepTemp) {
    try {
        const browser = await puppeteer.launch({ headless: true });
        var page = await fetchPage(browser, url);
        var result = await createIBMReport(page, idx, output);
        await browser.close();
        await JSONtoXLSX(result.report, idx, output);
        await GenerateVisualReport(url, idx, output);
        console.log("Report generated in : ", `${output}`);
        if (keepTemp) return;

        // delete Temp folder (this approach because of a glitch)
        if (idx == -1 || idx == 0) {
            let n = 0;
            process.on('beforeExit', () => {
                if (n < 2) {
                    DeleteFolder(idx, output);
                    n++;
                }
            });
            process.on('exit', () => {console.log("Temp folder deleted.")});
        }

    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.log('Error 404: Page not found for URL:', url);
        } else {
            console.log('Error running report for URL:', url, error);
        }
        return;
    }
}

async function run(options = null) {
    checker.getConfig();
    var URL = null;
    var runForSiteMap = false;
    var keepTemp = false;
    var output = null;
    if (options) {
        URL = options.URL;
        runForSiteMap = (options.Sitemap === "true") ? true : false;
        keepTemp = (options.Temp === "true") ? true : false;
        output = options.Output;
    }
    aceconfig.outputFolder = `${options.Output}/temp`
    if (!URL) return;
    if (runForSiteMap) {
        getSiteMap(URL)
            .then(async sitemapUrls => {
                if (Array.isArray(sitemapUrls)) {
                    console.log("URL(s):");
                    var idx = 0;
                    for (let url of sitemapUrls) {
                        console.log(url, " ", idx);
                        idx++;
                    }
                    console.log("--------------");
                    
                    idx = 0;
                    for (let url of sitemapUrls) {
                        try {
                            console.log(url, " ", idx);
                            await runReport(url, idx, output, keepTemp);
                        } catch (error) {
                            console.error('Error running report for URL:', url, error);
                            continue; // Continue to the next iteration
                        }
                        idx++;
                    }
                } else {
                    console.error('sitemapUrls is not an array:', sitemapUrls);
                }
            })
    } else {
        try {
            console.log("URL(s):");
            console.log(URL, " ");
            runReport(URL, -1, output, keepTemp); // indicates singular report
        } catch (error) {
            console.error('Error running report for URL:', URL, error);
        }
    }
}

module.exports = {
    run
};