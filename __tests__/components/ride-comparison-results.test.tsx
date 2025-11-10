import { render, screen } from '@testing-library/react'
import RideComparisonResults from '@/components/ride-comparison-results'
import { AuthProvider } from '@/lib/auth-context'

// Mock the auth context
jest.mock('@/lib/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    user: null,
    session: null,
    loading: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
  }),
}))

describe('RideComparisonResults', () => {
  const mockResults = {
    uber: {
      price: '$25.50',
      waitTime: '5 min',
      driversNearby: 4,
      service: 'UberX',
    },
    lyft: {
      price: '$23.75',
      waitTime: '6 min',
      driversNearby: 3,
      service: 'Lyft Standard',
    },
    taxi: {
      price: '$30.00',
      waitTime: '8 min',
      driversNearby: 2,
      service: 'Yellow Cab',
    },
  }

  const mockInsights =
    'Based on price and wait time, Lyft appears to be your best option for this trip.'

  it('renders the results with all ride services', () => {
    render(<RideComparisonResults results={mockResults} insights={mockInsights} />)

    expect(screen.getByText('Uber')).toBeInTheDocument()
    expect(screen.getByText('Lyft')).toBeInTheDocument()
    expect(screen.getByText('Taxi')).toBeInTheDocument()
  })

  it('displays the correct pricing information', () => {
    render(<RideComparisonResults results={mockResults} insights={mockInsights} />)

    expect(screen.getByText('$25.50')).toBeInTheDocument()
    expect(screen.getAllByText('$23.75')).toHaveLength(2) // Summary and Lyft card
    expect(screen.getByText('$30.00')).toBeInTheDocument()
  })

  it('shows the insights message', () => {
    render(<RideComparisonResults results={mockResults} insights={mockInsights} />)

    expect(screen.getByText(mockInsights)).toBeInTheDocument()
  })

  it('displays wait times and driver availability', () => {
    render(<RideComparisonResults results={mockResults} insights={mockInsights} />)

    // Check wait times - use getAllByText since there are multiple instances
    expect(screen.getAllByText('5 min')).toHaveLength(2) // Summary and Uber card
    expect(screen.getByText('6 min')).toBeInTheDocument() // Lyft card
    expect(screen.getByText('8 min')).toBeInTheDocument() // Taxi card

    // Check driver counts - use getAllByText since there are multiple instances
    expect(screen.getAllByText('4')).toHaveLength(1) // Driver count for Uber
    expect(screen.getAllByText('3')).toHaveLength(1) // Driver count for Lyft
    expect(screen.getAllByText('2')).toHaveLength(1) // Driver count for Taxi
    expect(screen.getAllByText('Drivers')).toHaveLength(3) // Label appears 3 times
  })

  it('displays service icons correctly', () => {
    render(<RideComparisonResults results={mockResults} insights={mockInsights} />)

    // Check for service names instead of test IDs since the component uses text-based icons
    expect(screen.getByText('Uber')).toBeInTheDocument()
    expect(screen.getByText('Lyft')).toBeInTheDocument()
    expect(screen.getByText('Taxi')).toBeInTheDocument()
  })

  it('formats prices consistently', () => {
    render(<RideComparisonResults results={mockResults} insights={mockInsights} />)

    const prices = screen.getAllByText(/\$\d+\.\d{2}/)
    expect(prices).toHaveLength(4) // Summary section + 3 service cards
  })

  it('handles edge case with zero drivers nearby', () => {
    const edgeCaseResults = {
      ...mockResults,
      uber: {
        ...mockResults.uber,
        driversNearby: 0,
      },
    }

    render(<RideComparisonResults results={edgeCaseResults} insights={mockInsights} />)

    expect(screen.getByText('0')).toBeInTheDocument() // Driver count for Uber
    expect(screen.getAllByText('Drivers')).toHaveLength(3) // Label appears 3 times
  })
})
