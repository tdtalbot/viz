Make sure that NodeJS is installed ([https://nodejs.org/en/](https://nodejs.org/en/))

# For development
## Bootstrapping the front-end
- `cd frontend`
- `npm install`
- `npm run dev`
- Go to http://localhost:4000

## Bootstrapping the back-end
- `cd backend`
- `npm install`
- `npm run nodemon` to start an HTTP server with hot-loading
- Then in a different terminal, `npm run tsc` to start the compilation in watch mode

# For deployment
## Building the front-end code
- `cd frontend`
- `npm install`
- `npm run build`

## Building the back-end code
- `cd backend`
- `npm install`
- `npm run build`
- `npm start`
