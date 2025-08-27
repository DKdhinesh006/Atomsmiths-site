import { MongoClient } from "mongodb";
// Uncomment below if using MySQL
// import mysql from 'mysql2/promise';

// Database connection caching for MongoDB
let cached = global._mongo;
if (!cached) {
  cached = global._mongo = { conn: null, promise: null };
}

// Database connection caching for MySQL (if using)
let mysqlPool = null;

/**
 * MongoDB Connection Handler
 */
async function connectToMongoDB(uri) {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    const client = new MongoClient(uri, { 
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      minPoolSize: 2
    });
    cached.promise = client.connect().then((client) => {
      return { client, db: client.db(process.env.MONGODB_DB || "atomsmiths") };
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

/**
 * MySQL Connection Handler (uncomment if using MySQL)
 */
/*
async function connectToMySQL() {
  if (!mysqlPool) {
    mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'atomsmiths_club',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return mysqlPool;
}
*/

/**
 * Database Service Class
 */
class DatabaseService {
  constructor() {
    this.dbType = process.env.DB_TYPE || 'mongodb'; // 'mongodb' or 'mysql'
  }

  // ====================================================
  // MEMBER OPERATIONS
  // ====================================================

  async registerMember(memberData) {
    const { name, email, department, year, interests } = memberData;
    
    // Validation
    if (!name || !email) {
      throw new Error('Name and email are required');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    if (this.dbType === 'mongodb') {
      const { db } = await connectToMongoDB(process.env.MONGODB_URI);
      
      // Check if email already exists
      const existingMember = await db.collection("members").findOne({ email });
      if (existingMember) {
        throw new Error('Email already registered');
      }
      
      const member = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        department: department?.trim() || null,
        year: year || null,
        interests: interests?.trim() || null,
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.collection("members").insertOne(member);
      return { ...member, _id: result.insertedId };
      
    } else if (this.dbType === 'mysql') {
      // MySQL implementation using stored procedures
      /*
      const connection = await connectToMySQL();
      const [rows] = await connection.execute(
        'CALL register_member(?, ?, ?, ?)',
        [name.trim(), email.toLowerCase().trim(), department?.trim() || '', year || '']
      );
      return rows[0][0];
      */
      throw new Error('MySQL implementation not enabled');
    }
  }

  async getMembers(limit = 100, skip = 0) {
    if (this.dbType === 'mongodb') {
      const { db } = await connectToMongoDB(process.env.MONGODB_URI);
      const members = await db.collection("members")
        .find({})
        .sort({ joinedAt: -1 })
        .limit(limit)
        .skip(skip)
        .toArray();
      return members;
      
    } else if (this.dbType === 'mysql') {
      /*
      const connection = await connectToMySQL();
      const [rows] = await connection.execute('CALL get_members()');
      return rows[0];
      */
      throw new Error('MySQL implementation not enabled');
    }
  }

  async getMemberById(memberId) {
    if (this.dbType === 'mongodb') {
      const { db } = await connectToMongoDB(process.env.MONGODB_URI);
      const { ObjectId } = await import('mongodb');
      return await db.collection("members").findOne({ _id: new ObjectId(memberId) });
      
    } else if (this.dbType === 'mysql') {
      /*
      const connection = await connectToMySQL();
      const [rows] = await connection.execute('CALL get_member_by_id(?)', [memberId]);
      return rows[0][0] || null;
      */
      throw new Error('MySQL implementation not enabled');
    }
  }

  async updateMember(memberId, updateData) {
    const { name, email, department, year, interests } = updateData;
    
    if (this.dbType === 'mongodb') {
      const { db } = await connectToMongoDB(process.env.MONGODB_URI);
      const { ObjectId } = await import('mongodb');
      
      // Check if email is taken by another member
      if (email) {
        const existingMember = await db.collection("members").findOne({
          email: email.toLowerCase().trim(),
          _id: { $ne: new ObjectId(memberId) }
        });
        if (existingMember) {
          throw new Error('Email already taken by another member');
        }
      }
      
      const updateFields = {
        ...(name && { name: name.trim() }),
        ...(email && { email: email.toLowerCase().trim() }),
        ...(department && { department: department.trim() }),
        ...(year && { year }),
        ...(interests && { interests: interests.trim() }),
        updatedAt: new Date()
      };
      
      const result = await db.collection("members").findOneAndUpdate(
        { _id: new ObjectId(memberId) },
        { $set: updateFields },
        { returnDocument: 'after' }
      );
      
      if (!result.value) {
        throw new Error('Member not found');
      }
      
      return result.value;
      
    } else if (this.dbType === 'mysql') {
      /*
      const connection = await connectToMySQL();
      const [rows] = await connection.execute(
        'CALL update_member(?, ?, ?, ?, ?)',
        [memberId, name, email, department, year]
      );
      return rows[0][0];
      */
      throw new Error('MySQL implementation not enabled');
    }
  }

  async deleteMember(memberId) {
    if (this.dbType === 'mongodb') {
      const { db } = await connectToMongoDB(process.env.MONGODB_URI);
      const { ObjectId } = await import('mongodb');
      
      const result = await db.collection("members").deleteOne({ _id: new ObjectId(memberId) });
      if (result.deletedCount === 0) {
        throw new Error('Member not found');
      }
      
      // Also delete related blogs
      await db.collection("blogs").deleteMany({ authorId: memberId });
      
      return { message: 'Member deleted successfully' };
      
    } else if (this.dbType === 'mysql') {
      /*
      const connection = await connectToMySQL();
      const [rows] = await connection.execute('CALL delete_member(?)', [memberId]);
      return rows[0][0];
      */
      throw new Error('MySQL implementation not enabled');
    }
  }

  // ====================================================
  // EVENT OPERATIONS
  // ====================================================

  async addEvent(eventData) {
    const { title, description, eventDate, location } = eventData;
    
    if (!title || !eventDate) {
      throw new Error('Title and event date are required');
    }
    
    const eventDateObj = new Date(eventDate);
    if (eventDateObj <= new Date()) {
      throw new Error('Event date must be in the future');
    }

    if (this.dbType === 'mongodb') {
      const { db } = await connectToMongoDB(process.env.MONGODB_URI);
      
      const event = {
        title: title.trim(),
        description: description?.trim() || null,
        eventDate: eventDateObj,
        location: location?.trim() || null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.collection("events").insertOne(event);
      return { ...event, _id: result.insertedId };
      
    } else if (this.dbType === 'mysql') {
      /*
      const connection = await connectToMySQL();
      const [rows] = await connection.execute(
        'CALL add_event(?, ?, ?, ?)',
        [title, description, eventDate, location]
      );
      return rows[0][0];
      */
      throw new Error('MySQL implementation not enabled');
    }
  }

  async getEvents(upcomingOnly = false) {
    if (this.dbType === 'mongodb') {
      const { db } = await connectToMongoDB(process.env.MONGODB_URI);
      
      const filter = upcomingOnly ? { eventDate: { $gt: new Date() } } : {};
      const events = await db.collection("events")
        .find(filter)
        .sort({ eventDate: 1 })
        .toArray();
      
      return events;
      
    } else if (this.dbType === 'mysql') {
      /*
      const connection = await connectToMySQL();
      const procedure = upcomingOnly ? 'list_upcoming_events' : 'list_events';
      const [rows] = await connection.execute(`CALL ${procedure}()`);
      return rows[0];
      */
      throw new Error('MySQL implementation not enabled');
    }
  }

  async getEventById(eventId) {
    if (this.dbType === 'mongodb') {
      const { db } = await connectToMongoDB(process.env.MONGODB_URI);
      const { ObjectId } = await import('mongodb');
      return await db.collection("events").findOne({ _id: new ObjectId(eventId) });
      
    } else if (this.dbType === 'mysql') {
      /*
      const connection = await connectToMySQL();
      const [rows] = await connection.execute('CALL get_event_by_id(?)', [eventId]);
      return rows[0][0] || null;
      */
      throw new Error('MySQL implementation not enabled');
    }
  }

  async updateEvent(eventId, updateData) {
    const { title, description, eventDate, location } = updateData;
    
    if (this.dbType === 'mongodb') {
      const { db } = await connectToMongoDB(process.env.MONGODB_URI);
      const { ObjectId } = await import('mongodb');
      
      const updateFields = {
        ...(title && { title: title.trim() }),
        ...(description && { description: description.trim() }),
        ...(eventDate && { eventDate: new Date(eventDate) }),
        ...(location && { location: location.trim() }),
        updatedAt: new Date()
      };
      
      const result = await db.collection("events").findOneAndUpdate(
        { _id: new ObjectId(eventId) },
        { $set: updateFields },
        { returnDocument: 'after' }
      );
      
      if (!result.value) {
        throw new Error('Event not found');
      }
      
      return result.value;
      
    } else if (this.dbType === 'mysql') {
      /*
      const connection = await connectToMySQL();
      const [rows] = await connection.execute(
        'CALL update_event(?, ?, ?, ?, ?)',
        [eventId, title, description, eventDate, location]
      );
      return rows[0][0];
      */
      throw new Error('MySQL implementation not enabled');
    }
  }

  async deleteEvent(eventId) {
    if (this.dbType === 'mongodb') {
      const { db } = await connectToMongoDB(process.env.MONGODB_URI);
      const { ObjectId } = await import('mongodb');
      
      const result = await db.collection("events").deleteOne({ _id: new ObjectId(eventId) });
      if (result.deletedCount === 0) {
        throw new Error('Event not found');
      }
      
      return { message: 'Event deleted successfully' };
      
    } else if (this.dbType === 'mysql') {
      /*
      const connection = await connectToMySQL();
      const [rows] = await connection.execute('CALL delete_event(?)', [eventId]);
      return rows[0][0];
      */
      throw new Error('MySQL implementation not enabled');
    }
  }

  // ====================================================
  // BLOG OPERATIONS
  // ====================================================

  async addBlog(blogData) {
    const { title, content, authorId } = blogData;
    
    if (!title || !content || !authorId) {
      throw new Error('Title, content, and author ID are required');
    }

    if (this.dbType === 'mongodb') {
      const { db } = await connectToMongoDB(process.env.MONGODB_URI);
      const { ObjectId } = await import('mongodb');
      
      // Check if author exists
      const author = await db.collection("members").findOne({ _id: new ObjectId(authorId) });
      if (!author) {
        throw new Error('Author not found');
      }
      
      const blog = {
        title: title.trim(),
        content: content.trim(),
        authorId: authorId,
        authorName: author.name,
        authorEmail: author.email,
        authorDepartment: author.department,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.collection("blogs").insertOne(blog);
      return { ...blog, _id: result.insertedId };
      
    } else if (this.dbType === 'mysql') {
      /*
      const connection = await connectToMySQL();
      const [rows] = await connection.execute(
        'CALL add_blog(?, ?, ?)',
        [title, content, authorId]
      );
      return rows[0][0];
      */
      throw new Error('MySQL implementation not enabled');
    }
  }

  async getBlogs(limit = 50, skip = 0) {
    if (this.dbType === 'mongodb') {
      const { db } = await connectToMongoDB(process.env.MONGODB_URI);
      const blogs = await db.collection("blogs")
        .find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .toArray();
      
      return blogs;
      
    } else if (this.dbType === 'mysql') {
      /*
      const connection = await connectToMySQL();
      const [rows] = await connection.execute('CALL list_blogs()');
      return rows[0];
      */
      throw new Error('MySQL implementation not enabled');
    }
  }

  async getBlogById(blogId) {
    if (this.dbType === 'mongodb') {
      const { db } = await connectToMongoDB(process.env.MONGODB_URI);
      const { ObjectId } = await import('mongodb');
      return await db.collection("blogs").findOne({ _id: new ObjectId(blogId) });
      
    } else if (this.dbType === 'mysql') {
      /*
      const connection = await connectToMySQL();
      const [rows] = await connection.execute('CALL get_blog_by_id(?)', [blogId]);
      return rows[0][0] || null;
      */
      throw new Error('MySQL implementation not enabled');
    }
  }

  async getBlogsByAuthor(authorId) {
    if (this.dbType === 'mongodb') {
      const { db } = await connectToMongoDB(process.env.MONGODB_URI);
      const blogs = await db.collection("blogs")
        .find({ authorId })
        .sort({ createdAt: -1 })
        .toArray();
      
      return blogs;
      
    } else if (this.dbType === 'mysql') {
      /*
      const connection = await connectToMySQL();
      const [rows] = await connection.execute('CALL get_blogs_by_author(?)', [authorId]);
      return rows[0];
      */
      throw new Error('MySQL implementation not enabled');
    }
  }

  async updateBlog(blogId, updateData) {
    const { title, content } = updateData;
    
    if (this.dbType === 'mongodb') {
      const { db } = await connectToMongoDB(process.env.MONGODB_URI);
      const { ObjectId } = await import('mongodb');
      
      const updateFields = {
        ...(title && { title: title.trim() }),
        ...(content && { content: content.trim() }),
        updatedAt: new Date()
      };
      
      const result = await db.collection("blogs").findOneAndUpdate(
        { _id: new ObjectId(blogId) },
        { $set: updateFields },
        { returnDocument: 'after' }
      );
      
      if (!result.value) {
        throw new Error('Blog not found');
      }
      
      return result.value;
      
    } else if (this.dbType === 'mysql') {
      /*
      const connection = await connectToMySQL();
      const [rows] = await connection.execute(
        'CALL update_blog(?, ?, ?)',
        [blogId, title, content]
      );
      return rows[0][0];
      */
      throw new Error('MySQL implementation not enabled');
    }
  }

  async deleteBlog(blogId) {
    if (this.dbType === 'mongodb') {
      const { db } = await connectToMongoDB(process.env.MONGODB_URI);
      const { ObjectId } = await import('mongodb');
      
      const result = await db.collection("blogs").deleteOne({ _id: new ObjectId(blogId) });
      if (result.deletedCount === 0) {
        throw new Error('Blog not found');
      }
      
      return { message: 'Blog deleted successfully' };
      
    } else if (this.dbType === 'mysql') {
      /*
      const connection = await connectToMySQL();
      const [rows] = await connection.execute('CALL delete_blog(?)', [blogId]);
      return rows[0][0];
      */
      throw new Error('MySQL implementation not enabled');
    }
  }

  // ====================================================
  // DASHBOARD & STATISTICS
  // ====================================================

  async getDashboardStats() {
    if (this.dbType === 'mongodb') {
      const { db } = await connectToMongoDB(process.env.MONGODB_URI);
      
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const [
        totalMembers,
        upcomingEvents,
        pastEvents,
        totalBlogs,
        newMembersToday,
        newBlogsToday
      ] = await Promise.all([
        db.collection("members").countDocuments(),
        db.collection("events").countDocuments({ eventDate: { $gt: now } }),
        db.collection("events").countDocuments({ eventDate: { $lte: now } }),
        db.collection("blogs").countDocuments(),
        db.collection("members").countDocuments({ joinedAt: { $gte: todayStart } }),
        db.collection("blogs").countDocuments({ createdAt: { $gte: todayStart } })
      ]);
      
      return {
        totalMembers,
        upcomingEvents,
        pastEvents,
        totalBlogs,
        newMembersToday,
        newBlogsToday
      };
      
    } else if (this.dbType === 'mysql') {
      /*
      const connection = await connectToMySQL();
      const [rows] = await connection.execute('CALL get_dashboard_stats()');
      return rows[0][0];
      */
      throw new Error('MySQL implementation not enabled');
    }
  }

  async getRecentActivity(limit = 10) {
    if (this.dbType === 'mongodb') {
      const { db } = await connectToMongoDB(process.env.MONGODB_URI);
      
      const memberActivities = await db.collection("members")
        .find({})
        .sort({ joinedAt: -1 })
        .limit(5)
        .toArray();
      
      const blogActivities = await db.collection("blogs")
        .find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();
      
      const eventActivities = await db.collection("events")
        .find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();
      
      const activities = [
        ...memberActivities.map(m => ({
          activityType: 'member_joined',
          description: `${m.name} joined the club`,
          activityDate: m.joinedAt
        })),
        ...blogActivities.map(b => ({
          activityType: 'blog_published',
          description: `New blog: ${b.title}`,
          activityDate: b.createdAt
        })),
        ...eventActivities.map(e => ({
          activityType: 'event_created',
          description: `Event scheduled: ${e.title}`,
          activityDate: e.createdAt
        }))
      ];
      
      return activities
        .sort((a, b) => b.activityDate - a.activityDate)
        .slice(0, limit);
      
    } else if (this.dbType === 'mysql') {
      /*
      const connection = await connectToMySQL();
      const [rows] = await connection.execute('CALL get_recent_activity()');
      return rows[0];
      */
      throw new Error('MySQL implementation not enabled');
    }
  }

  async getMemberStats() {
    if (this.dbType === 'mongodb') {
      const { db } = await connectToMongoDB(process.env.MONGODB_URI);
      
      const departmentStats = await db.collection("members").aggregate([
        {
          $group: {
            _id: "$department",
            memberCount: { $sum: 1 }
          }
        },
        {
          $project: {
            department: "$_id",
            memberCount: 1,
            _id: 0
          }
        },
        {
          $sort: { memberCount: -1 }
        }
      ]).toArray();
      
      const yearStats = await db.collection("members").aggregate([
        {
          $group: {
            _id: "$year",
            memberCount: { $sum: 1 }
          }
        },
        {
          $project: {
            year: "$_id",
            memberCount: 1,
            _id: 0
          }
        }
      ]).toArray();
      
      // Calculate percentages for department stats
      const totalMembers = await db.collection("members").countDocuments();
      const departmentStatsWithPercentage = departmentStats.map(stat => ({
        ...stat,
        percentage: parseFloat((stat.memberCount * 100 / totalMembers).toFixed(2))
      }));
      
      return {
        departmentStats: departmentStatsWithPercentage,
        yearStats
      };
      
    } else if (this.dbType === 'mysql') {
      /*
      const connection = await connectToMySQL();
      const [rows] = await connection.execute('CALL get_member_stats()');
      return {
        departmentStats: rows[0],
        yearStats: rows[1]
      };
      */
      throw new Error('MySQL implementation not enabled');
    }
  }
}

// Create and export a singleton instance
const dbService = new DatabaseService();

// ====================================================
// API ENDPOINT HANDLER
// ====================================================

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    const { method, query, body } = req;
    const { action, id } = query;

    // Parse body if it's a string
    let parsedBody = body;
    if (typeof body === "string") {
      try { parsedBody = JSON.parse(body); } catch {}
    }

    switch (action) {
      // ====================================================
      // MEMBER ENDPOINTS
      // ====================================================
      case 'members':
        if (method === 'GET') {
          if (id) {
            const member = await dbService.getMemberById(id);
            res.status(200).json({ ok: true, data: member });
          } else {
            const { limit = 100, skip = 0 } = query;
            const members = await dbService.getMembers(parseInt(limit), parseInt(skip));
            res.status(200).json({ ok: true, data: members });
          }
        } else if (method === 'POST') {
          const member = await dbService.registerMember(parsedBody);
          res.status(201).json({ ok: true, data: member });
        } else if (method === 'PUT') {
          if (!id) throw new Error('Member ID required');
          const member = await dbService.updateMember(id, parsedBody);
          res.status(200).json({ ok: true, data: member });
        } else if (method === 'DELETE') {
          if (!id) throw new Error('Member ID required');
          const result = await dbService.deleteMember(id);
          res.status(200).json({ ok: true, data: result });
        } else {
          res.status(405).json({ error: 'Method not allowed' });
        }
        break;

      // ====================================================
      // EVENT ENDPOINTS
      // ====================================================
      case 'events':
        if (method === 'GET') {
          if (id) {
            const event = await dbService.getEventById(id);
            res.status(200).json({ ok: true, data: event });
          } else {
            const { upcoming } = query;
            const events = await dbService.getEvents(upcoming === 'true');
            res.status(200).json({ ok: true, data: events });
          }
        } else if (method === 'POST') {
          const event = await dbService.addEvent(parsedBody);
          res.status(201).json({ ok: true, data: event });
        } else if (method === 'PUT') {
          if (!id) throw new Error('Event ID required');
          const event = await dbService.updateEvent(id, parsedBody);
          res.status(200).json({ ok: true, data: event });
        } else if (method === 'DELETE') {
          if (!id) throw new Error('Event ID required');
          const result = await dbService.deleteEvent(id);
          res.status(200).json({ ok: true, data: result });
        } else {
          res.status(405).json({ error: 'Method not allowed' });
        }
        break;

      // ====================================================
      // BLOG ENDPOINTS
      // ====================================================
      case 'blogs':
        if (method === 'GET') {
          if (id) {
            const blog = await dbService.getBlogById(id);
            res.status(200).json({ ok: true, data: blog });
          } else if (query.author) {
            const blogs = await dbService.getBlogsByAuthor(query.author);
            res.status(200).json({ ok: true, data: blogs });
          } else {
            const { limit = 50, skip = 0 } = query;
            const blogs = await dbService.getBlogs(parseInt(limit), parseInt(skip));
            res.status(200).json({ ok: true, data: blogs });
          }
        } else if (method === 'POST') {
          const blog = await dbService.addBlog(parsedBody);
          res.status(201).json({ ok: true, data: blog });
        } else if (method === 'PUT') {
          if (!id) throw new Error('Blog ID required');
          const blog = await dbService.updateBlog(id, parsedBody);
          res.status(200).json({ ok: true, data: blog });
        } else if (method === 'DELETE') {
          if (!id) throw new Error('Blog ID required');
          const result = await dbService.deleteBlog(id);
          res.status(200).json({ ok: true, data: result });
        } else {
          res.status(405).json({ error: 'Method not allowed' });
        }
        break;

      // ====================================================
      // DASHBOARD & STATS ENDPOINTS
      // ====================================================
      case 'dashboard':
        if (method === 'GET') {
          const stats = await dbService.getDashboardStats();
          res.status(200).json({ ok: true, data: stats });
        } else {
          res.status(405).json({ error: 'Method not allowed' });
        }
        break;

      case 'activity':
        if (method === 'GET') {
          const { limit = 10 } = query;
          const activities = await dbService.getRecentActivity(parseInt(limit));
          res.status(200).json({ ok: true, data: activities });
        } else {
          res.status(405).json({ error: 'Method not allowed' });
        }
        break;

      case 'stats':
        if (method === 'GET') {
          const stats = await dbService.getMemberStats();
          res.status(200).json({ ok: true, data: stats });
        } else {
          res.status(405).json({ error: 'Method not allowed' });
        }
        break;

      default:
        res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error) {
    console.error('Database API Error:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Export the service for use in other files
export { dbService, DatabaseService };