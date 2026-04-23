/**
 * Accessibility tests using axe-core
 * Validates WCAG 2.1 AA in critical components
 */

import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import '@testing-library/jest-dom'
import { Sidebar } from '../components/layout/sidebar'
import { Topbar } from '../components/layout/topbar'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Skeleton } from '../components/ui/skeleton'
import { Switch } from '../components/ui/switch'
import { Textarea } from '../components/ui/textarea'
import { Tooltip } from '../components/ui/tooltip'

declare global {
    namespace jest {
        interface Matchers<R> {
            toHaveNoViolations(): R
        }
    }
}

describe('Accessibility Tests - WCAG 2.1 AA', () => {
    describe('Layout Components', () => {
        it('Sidebar should be accessible', async () => {
            const { container } = render(
                <Sidebar collapsed={false} onToggle={() => { }} />
            )
            const results = await axe(container)
            expect(results).toHaveNoViolations()
        })

        it('Topbar should be accessible', async () => {
            const { container } = render(<Topbar />)
            const results = await axe(container)
            expect(results).toHaveNoViolations()
        })
    })

    describe('UI Components', () => {
        it('Button should be accessible', async () => {
            const { container } = render(
                <Button onClick={() => { }}>Click me</Button>
            )
            const results = await axe(container)
            expect(results).toHaveNoViolations()
        })

        it('Button with loading state should be accessible', async () => {
            const { container } = render(
                <Button isLoading={true}>Loading</Button>
            )
            const results = await axe(container)
            expect(results).toHaveNoViolations()
        })

        it('Button disabled should be accessible', async () => {
            const { container } = render(
                <Button disabled={true}>Disabled</Button>
            )
            const results = await axe(container)
            expect(results).toHaveNoViolations()
        })

        it('Card should be accessible', async () => {
            const { container } = render(
                <Card>
                    <h3>Card Title</h3>
                    <p>Card content</p>
                </Card>
            )
            const results = await axe(container)
            expect(results).toHaveNoViolations()
        })

        it('Input should be accessible', async () => {
            const { container } = render(
                <Input
                    type="text"
                    placeholder="Enter text"
                    aria-label="Username input"
                />
            )
            const results = await axe(container)
            expect(results).toHaveNoViolations()
        })

        it('Select should be accessible', async () => {
            const { container } = render(
                <Select
                    options={[
                        { value: '1', label: 'Option 1' },
                        { value: '2', label: 'Option 2' },
                    ]}
                    aria-label="Choose an option"
                />
            )
            const results = await axe(container)
            expect(results).toHaveNoViolations()
        })

        it('Skeleton should be accessible', async () => {
            const { container } = render(<Skeleton className="h-10 w-20" />)
            const results = await axe(container)
            expect(results).toHaveNoViolations()
        })

        it('Switch should be accessible', async () => {
            const { container } = render(
                <Switch
                    checked={true}
                    onCheckedChange={() => { }}
                    aria-label="Toggle feature"
                />
            )
            const results = await axe(container)
            expect(results).toHaveNoViolations()
        })

        it('Textarea should be accessible', async () => {
            const { container } = render(
                <Textarea
                    placeholder="Enter description"
                    aria-label="Description textarea"
                />
            )
            const results = await axe(container)
            expect(results).toHaveNoViolations()
        })

        it('Toast should be accessible', async () => {
            const { container } = render(
                <Toast open={true} onOpenChange={() => { }}>
                    <Toast.Title>Success</Toast.Title>
                    <Toast.Description>Action completed</Toast.Description>
                </Toast>
            )
            const results = await axe(container)
            expect(results).toHaveNoViolations()
        })

        it('Tooltip should be accessible', async () => {
            const { container } = render(
                <Tooltip content="Help text">
                    <button>Hover me</button>
                </Tooltip>
            )
            const results = await axe(container)
            expect(results).toHaveNoViolations()
        })
    })

    describe('Keyboard Navigation', () => {
        it('Button should respond to Enter and Space keys', () => {
            const handleClick = jest.fn()
            const { getByText } = render(
                <Button onClick={handleClick}>Test Button</Button>
            )

            const button = getByText('Test Button')
            button.focus()

            // Test Enter key
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' })
            button.dispatchEvent(enterEvent)
            expect(handleClick).toHaveBeenCalled()

            // Test Space key
            const spaceEvent = new KeyboardEvent('keydown', { key: ' ' })
            button.dispatchEvent(spaceEvent)
            expect(handleClick).toHaveBeenCalledTimes(2)
        })
    })
})