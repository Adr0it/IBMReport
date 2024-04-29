library(rmarkdown)

# Retrieve the parameters from the command line
args = commandArgs(trailingOnly = TRUE)

url = args[1]
idx = args[3]
if (idx != -1) {
    excelpath = paste(args[2], '\\temp\\out', idx, '.xlsx', sep="")
} else {
    excelpath = paste(args[2], '\\temp\\out.xlsx', sep="")
}
print(paste("AutomatedReportHelper received excel filepath: ", excelpath))

# Render the visual report.
if (idx != -1) {
    render("./Rfiles/AutomatedReport.Rmd", output_file = paste("AutomatedReport", idx, ".html", sep = ""), output_dir = args[2], params = list(excelpath = excelpath, url = url))
} else {
    render("./Rfiles/AutomatedReport.Rmd", output_file = "AutomatedReport.html", output_dir = args[2], params = list(excelpath = excelpath, url = url))
}
