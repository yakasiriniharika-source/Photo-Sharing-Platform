const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', routes);

// catch requests to routes that don't exist
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// must be registered LAST — Express identifies this as an error handler
// specifically because it has 4 parameters
app.use(errorHandler);

module.exports = app;