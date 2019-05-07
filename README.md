# MS12-28-GQL
## Section 28 - Working with GraphQL

### 0. Frontend
- modified `MS12-25-Rest` to use GraphQL

### 1. Run
- `npm start` for `React` client (port 3000)
- `npm start` for `Node.js` server (port 4000)
- Uses `dotenv` package for environment variables in `.env` file
- Uses `fetch` and `POST` requests to `localhost:4000/graphql`

### 2. Database
- Uses `udemy` database on MongoDB Atlas
  - collections: `ms1225posts`, `ms1225users`

### 3. Backend NPM Packages
- `apollo-server-express: ^2.4.8`
- `bcryptjs: ^2.4.3`
- `cors: ^2.8.5`
- `dotenv: ^6.2.0`
- `express: ^4.16.4`
- `graphql: ^14.2.1`
- `jsonwebtoken: ^8.5.1`
- `mongodb: ^3.2.3`
- `mongoose: ^5.5.6`
- `multer: ^1.4.1`
- `validator: ^10.11.0`

Note: Changes made by this app will cause image files in `MS12-25-Rest/server/images` to be out of sync.
