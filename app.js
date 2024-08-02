const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const app = express();
const { jsPDF } = require('jspdf');
const port = 3000;

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/local', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to generate light color
function generateLightColor() {
  const red = Math.floor(Math.random() * 76) + 180;
  const green = Math.floor(Math.random() * 76) + 180;
  const blue = Math.floor(Math.random() * 76) + 180;
  return `${red.toString(16)}${green.toString(16)}${blue.toString(16)}`;
}
function extractMark( mark ) {
try {
  const data = JSON.parse(mark);
  return parseInt(data["1"], 10); 
} catch (error) {
  console.error("Error parsing JSON:", error.message);
  return 0; 
}
}
app.get('/', async (req, res) => {
  try {
    const db = mongoose.connection;
    const collection = db.collection('progresscard');

    // Fetch classes and sections from MongoDB
    const classesTable = await collection.findOne({ type: "table", name: "class" });
    const sectionsTable = await collection.findOne({ type: "table", name: "section" });

    const classes = classesTable.data.map(classe => ({ value: classe.id, name: classe.name }));
    const sections = sectionsTable.data.map(section => ({ value: section.id, name: section.name }));

    let classOptions = '<option label="Choose Class"></option>';
    classes.forEach(classe => {
      classOptions += `<option value="${classe.value}">${classe.name}</option>`;
    });

    let sectionOptions = '<option label="Choose Section"></option>';
    sections.forEach(section => {
      sectionOptions += `<option value="${section.value}">${section.name}</option>`;
    });

    // Construct the HTML content dynamically
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Select Student</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
      <style>
        body {
          background-color: #f8f9fa;
        }
        .card {
          margin-top: 20px;
        }
        .card-header {
          background-color: #007bff;
          color: white;
        }
        .btn-success {
          background-color: #28a745;
          border-color: #28a745;
        }
        .table th, .table td {
          vertical-align: middle;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="row">
          <div class="col-md-12">
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">Select Student</h3>
              </div>
              <div class="card-body">
                <div class="example">
                  <div class="form-group">
                    <label for="classes" class="form-label">Select Class</label>
                    <select id="classes" class="classes form-control select2-show-search form-select" data-placeholder="Choose one">
                      ${classOptions}
                    </select>
                  </div>
                  <br>
                  <div class="form-group">
                    <label for="sections" class="form-label">Select Section</label>
                    <select id="sections" class="sections form-control select2-show-search form-select" data-placeholder="Choose one">
                      ${sectionOptions}
                    </select>
                  </div>
                  <br>
                  <button class="btn btn-success btn-ok">OK</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="row">
          <div class="col-md-12">
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">Students</h3>
              </div>
              <div class="card-body">
                <div class="example">
                  <div class="table-responsive">
                    <table class="table table-bordered text-nowrap border-bottom" id="basic-datatable">
                      <thead>
                        <tr>
                          <th class="wd-15p border-bottom-0">No</th>
                          <th class="wd-15p border-bottom-0">Name</th>
                        </tr>
                      </thead>
                      <tbody class="searchresult">
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <script>
        $(document).ready(function() {
          $('.btn-ok').click(function() {
            const classId = $('.classes').val();
            const sectionId = $('.sections').val();

            if (classId && sectionId) {
              $.ajax({
                url: \`/students/\${classId}/\${sectionId}\`,
                method: 'GET',
                success: function(data) {
                  let rows = '';
                  data.forEach((student, index) => {
                    rows += \`
                      <tr>
                        <td>\${index + 1}</td>
                        <td><a href="/report/\${student.register_no}">\${student.first_name} \${student.last_name}</a></td>
                      </tr>
                    \`;
                  });
                  $('.searchresult').html(rows);
                },
                error: function(err) {
                  console.error('Error fetching students:', err);
                }
              });
            } else {
              alert('Please select both class and section');
            }
          });
        });
      </script>
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    </body>
    </html>
    `;

    res.send(htmlContent); // Send the constructed HTML content
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).send('Error fetching data');
  }
});

app.get('/students/:classId/:sectionId', async (req, res) => {
  try {
    const db = mongoose.connection;
    const collection = db.collection('progresscard');
    const classId = parseInt(req.params.classId);
    const sectionId = parseInt(req.params.sectionId);

    const enrollTable = await collection.findOne({ type: "table", name: "enroll" });
    const studentTable = await collection.findOne({ type: "table", name: "student" });

    const enrolledStudents = enrollTable.data.filter(enroll => enroll.class_id == classId && enroll.section_id == sectionId);
    const studentList = enrolledStudents.map(enroll => {
      return studentTable.data.find(student => student.id == enroll.student_id);
    });

    res.json(studentList);
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).send('Error fetching students');
  }
});


app.get('/report/:studentId', async (req, res) => {
  try {
    const db = mongoose.connection;
    const collection = db.collection('progresscard');
    const studentId = req.params.studentId;
    
    const studentTable = await collection.findOne({ type: "table", name: "student" });
    const student = studentTable.data.find(student => student.register_no == studentId);
    
    if (!student) {
      return res.status(404).send('Student not found');
    }

    const enrollTable = await collection.findOne({ type: "table", name: "enroll" });
    const enroll = enrollTable.data.find(en => en.student_id == student.id);

    if (!enroll) {
      return res.status(404).send('Enrollment data not found for the student');
    }

    const classesTable = await collection.findOne({ type: "table", name: "class" });
    const markTable = await collection.findOne({ type: "table", name: "mark" });
    const subjectsTable = await collection.findOne({ type: "table", name: "subject" });
    
    if (!classesTable || !markTable || !subjectsTable) {
      return res.status(404).send('Class, marks, or subjects table not found');
    }

    const marks = markTable.data.filter(mark => mark.student_id == student.id);
    
    if (marks.length === 0) {
      return res.status(404).send('Marks not found for the student');
    }

    // Prepare data to insert into HTML
    let uniqueSubjects = [];
    let tableRows = '';

    marks.forEach((m) => {
      const subject = subjectsTable.data.find(sub => sub.id.toString() == m.subject_id.toString());
      if (subject && !uniqueSubjects.includes(subject.name)) {
        uniqueSubjects.push(subject.name);

        const firstMidTerm = extractMark(marks.find(mark => mark.exam_id == 1 && mark.subject_id.toString() == m.subject_id.toString())?.mark)||'NA';
        const quarterly = extractMark(marks.find(mark => mark.exam_id == 4 && mark.subject_id.toString() == m.subject_id.toString())?.mark)||'NA';
        const secondMidTerm = extractMark(marks.find(mark => mark.exam_id == 2 && mark.subject_id.toString() == m.subject_id.toString())?.mark)||'NA';

        tableRows += `
          <tr>
            <td style="background: #${generateLightColor()}">${subject.name.split(' ') // Split the name into an array of words
              .map(word => {
                let newWord = "";
                for (let i = 0; i < word.length; i++) {
                  const char = word[i];
                  if (i === 0 || char === '(' || char === ')') {
                    newWord += char; // Keep first letter, parentheses as-is
                  } else {
                    newWord += char.toLowerCase(); // Lowercase other characters
                  }
                }
                return newWord;
              })
              .join(' ')}
              </td>
            <td>100</td>
            <td>35</td>
            <td>${firstMidTerm}</td>
            <td>${quarterly}</td>
            <td>${secondMidTerm}</td>
            <td>NA</td>
            <td>NA</td>
            <td>NA</td>
            <td></td>
          </tr>
        `;
      }
    });

    const totalMaxMarks = uniqueSubjects.length * 100;
    const totalMinMarks = uniqueSubjects.length * 35;
    const totalFirstMidTerm = marks.filter(m => m.exam_id == 1).reduce((sum, m) => sum + extractMark(m.mark), 0);
    const totalQuarterly = marks.filter(m => m.exam_id == 4).reduce((sum, m) => sum + extractMark(m.mark), 0);
    const totalSecondMidTerm = marks.filter(m => m.exam_id == 2).reduce((sum, m) => sum + extractMark(m.mark), 0);

    tableRows += `
      <tr>
        <td style="background: #${generateLightColor()}">Total</td>
        <td>${totalMaxMarks}</td>
        <td>${totalMinMarks}</td>
        <td>${totalFirstMidTerm}</td>
        <td>${totalQuarterly}</td>
        <td>${totalSecondMidTerm}</td>
        <td>NA</td>
        <td>NA</td>
        <td>NA</td>
        <td></td>
      </tr>
      <tr>
        <td style="background: #${generateLightColor()}">Attendance</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
      <tr>
        <td style="background: #${generateLightColor()}">Class Teacher's Signature</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
      <tr>
        <td style="background: #${generateLightColor()}">Principal's Signature</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
      <tr>
        <td style="background: #${generateLightColor()}">Parent's/Guardian's Sign</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    `;

    fs.readFile(path.join(__dirname, 'public', 'report.html'), 'utf8', (err, html) => {
      if (err) {
        console.error('Error loading report template:', err);
        res.status(500).send('Error loading report template');
        return;
      }

      const className = classesTable.data.find(cls => cls.id == enroll.class_id)?.name || 'NA';
      console.log('Class ID:', enroll.class_id);
      console.log('Class Name:', className);

      html = html.replace('{{studentName}}', `${student.first_name} ${student.last_name}`);
      html = html.replace('{{className}}', className);
      html = html.replace('{{studentId}}', student.register_no);
      html = html.replace('{{tableRows}}', tableRows);

      res.send(html);
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).send('Error generating report');
  }
});

// Route to generate and download PDF report for a student
// Route to generate and download PDF report for a student
app.get('/pdf/:register_no', async (req, res) => {try {
  const db = mongoose.connection;
  const collection = db.collection('progresscard');
  const registerNo = req.params.register_no;

  const studentTable = await collection.findOne({ type: "table", name: "student" });
  const marksheetTable = await collection.findOne({ type: "table", name: "mark" });
  const subjectTable = await collection.findOne({ type: "table", name: "subject" });

  const student = studentTable.data.find(student => student.register_no === registerNo);

  if (!student) {
    return res.status(404).send('Student not found');
  }

  // Fetch marks for the student
  const marks = marksheetTable.data.filter(mark => mark.student_id === student.id);

  // Prepare content for the PDF
  const doc = new jsPDF();
  let y = 10;

  doc.setFontSize(18);
  doc.text(`Progress Report for ${student.first_name} ${student.last_name}`, 20, y);
  y += 10;

  doc.setFontSize(12);



  marks.forEach(mark => {
    let term = "";
    switch (mark.exam_id) {
      case '1':
        term = 'First Midterm';
        break;
      case '2':
        term = 'Quarterly';
        break;
      case '4':
        term = 'Second Midterm';
        break;

    }
    const subject = subjectTable.data.find(subject => subject.id === mark.subject_id);
    const markValue = extractMark(mark.mark);
    doc.text(`${term} : ${subject.name} : ${markValue}`, 20, y);
    y += 10;
  });

  // Save PDF to a file
  const pdfPath = path.join(__dirname, 'public', `progress_report_${student.register_no}.pdf`);
  doc.save(pdfPath);

  // Send the PDF as a response
  const pdfBytes = fs.readFileSync(pdfPath);
  res.contentType("application/pdf");
  res.send(pdfBytes);

  // Optionally, you can delete the saved PDF file after sending it
  fs.unlinkSync(pdfPath);
} catch (err) {
  console.error('Error generating PDF:', err);
  res.status(500).send('Error generating PDF');
}
});

// Function to generate PDF from HTML
async function generatePdfFromHtml(htmlContent, res) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({ format: 'A4' });

  await browser.close();

  res.setHeader('Content-Disposition', 'attachment; filename="progress_report.pdf"');
  res.setHeader('Content-Type', 'application/pdf');
  res.send(pdfBuffer);
}


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
