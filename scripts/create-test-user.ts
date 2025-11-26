import { prisma } from '../lib/prisma'
import bcrypt from 'bcryptjs'

async function createTestUser() {
  const email = process.argv[2] || 'mleonard1616@gmail.com'
  const password = process.argv[3] || 'testpassword123'
  const name = process.argv[4] || 'Matt Leonard'

  const hashedPassword = await bcrypt.hash(password, 10)

  try {
    const existing = await prisma.user.findUnique({
      where: { email },
    })

    if (existing) {
      console.log('User already exists, updating password...')
      await prisma.user.update({
        where: { email },
        data: { password: hashedPassword },
      })
      console.log('✅ Password updated!')
    } else {
      const user = await prisma.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
        },
      })
      console.log('✅ User created:', user.id)
    }

    console.log('\n📧 Email:', email)
    console.log('🔑 Password:', password)
    console.log('\nYou can now test sign-in with these credentials.')
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestUser()

