import * as React from "react";
import * as RadixNavigationMenu from "@radix-ui/react-navigation-menu";
import classNames from "classnames";
import { CaretDownIcon } from "@radix-ui/react-icons";
import { Link } from "react-router";

const NavigationMenu = () => {

	return (
		<RadixNavigationMenu.Root 
			className="relative z-50 flex w-full max-w-[1200px] mx-auto justify-between items-center pb-4"
			delayDuration={50}
			skipDelayDuration={100}
		>
			{/* Logo Section */}
			<div className="flex items-center gap-[18px]">
				<a href="/home" className="flex items-center justify-center w-6 h-6 cursor-pointer">
					<div className="w-[48px] h-[48px] cursor-pointer">
						<img 
							src="/white-icon.svg" 
							alt="Zero" 
							width={38} 
							height={38} 
							className="w-full h-full cursor-pointer"
						/>
					</div>
				</a>
			</div>

			{/* Navigation Items - Centered */}
			<div className="absolute left-1/2 transform -translate-x-1/2">
				<RadixNavigationMenu.List className="flex items-center gap-4">
					<RadixNavigationMenu.Item>
						<RadixNavigationMenu.Trigger className="group flex select-none items-center justify-center gap-1 rounded px-[6px] py-1 text-[14px] font-medium leading-[1.24] tracking-[-0.02em] text-white opacity-80 outline-none hover:opacity-100 transition-opacity">
							Company{" "}
							<CaretDownIcon
								className="relative w-[14px] h-[14px] text-white opacity-80 transition-all duration-250 ease-in group-data-[state=open]:-rotate-180 group-hover:opacity-100"
								aria-hidden
							/>
						</RadixNavigationMenu.Trigger>
						<RadixNavigationMenu.Content className="absolute left-0 top-0 w-full z-50 data-[motion=from-end]:animate-enterFromRight data-[motion=from-start]:animate-enterFromLeft data-[motion=to-end]:animate-exitToRight data-[motion=to-start]:animate-exitToLeft sm:w-auto">
							<ul className="one m-0 grid list-none gap-x-2.5 p-[22px] sm:w-[550px] sm:grid-cols-[0.75fr_1fr] bg-black/80 backdrop-blur-xl rounded-lg">
								<li className="row-span-3 grid">
									<RadixNavigationMenu.Link asChild>
										<a
											className="flex h-full w-full select-none flex-col justify-end rounded-lg p-[25px] no-underline outline-none"
											style={{
												backgroundImage: "url('/couple.jpeg')",
												backgroundSize: "cover",
												backgroundPosition: "center",
												backgroundRepeat: "no-repeat"
											}}
											href="/"
										>
											
										</a>
									</RadixNavigationMenu.Link>
								</li>

								<ListItem href="/about" title="About">
									Our mission and story
								</ListItem>
								<ListItem href="/team" title="Team">
									Meet the builders
								</ListItem>
								<ListItem href="/contributors" title="Contributors">
									Open source community
								</ListItem>
							</ul>
						</RadixNavigationMenu.Content>
					</RadixNavigationMenu.Item>

					<RadixNavigationMenu.Item>
						<RadixNavigationMenu.Trigger className="group flex select-none items-center justify-center gap-1 rounded px-[6px] py-1 text-[14px] font-medium leading-[1.24] tracking-[-0.02em] text-white opacity-80 outline-none hover:opacity-100 transition-opacity">
							Resource{" "}
							<CaretDownIcon
								className="relative w-[14px] h-[14px] text-white opacity-80 transition-all duration-250 ease-in group-data-[state=open]:-rotate-180 group-hover:opacity-100"
								aria-hidden
							/>
						</RadixNavigationMenu.Trigger>
						<RadixNavigationMenu.Content className="absolute left-0 top-0 w-full z-50 data-[motion=from-end]:animate-enterFromRight data-[motion=from-start]:animate-enterFromLeft data-[motion=to-end]:animate-exitToRight data-[motion=to-start]:animate-exitToLeft sm:w-auto">
							<ul className="one m-0 grid list-none gap-x-2.5 p-[22px] sm:w-[550px] sm:grid-cols-[0.75fr_1fr] bg-black/80 backdrop-blur-xl rounded-lg">
								<li className="row-span-3 grid">
									<RadixNavigationMenu.Link asChild>
										<a
											className="flex h-full w-full select-none flex-col justify-end rounded-lg p-[25px] no-underline outline-none"
											style={{
												backgroundImage: "url('/angel.jpeg')",
												backgroundSize: "cover",
												backgroundPosition: "center",
												backgroundRepeat: "no-repeat"
											}}
											href="/blog"
										>
											
										</a>
									</RadixNavigationMenu.Link>
								</li>

								<ListItem
									title="Product Updates"
									href="/blog"
								>
									Latest features shipped
								</ListItem>
								<ListItem
									title="AI Features"
									href="/features/ai"
								>
									Intelligent email workflows
								</ListItem>
								<ListItem title="Blog" href="/blog">
									Insights and updates
								</ListItem>
							</ul>
						</RadixNavigationMenu.Content>
					</RadixNavigationMenu.Item>
{/* 
					<RadixNavigationMenu.Item>
						<RadixNavigationMenu.Trigger className="group flex select-none items-center justify-center gap-1 rounded px-[6px] py-1 text-[14px] font-medium leading-[1.24] tracking-[-0.02em] text-white opacity-80 outline-none hover:opacity-100 transition-opacity">
							Docs{" "}
							<CaretDownIcon
								className="relative w-[14px] h-[14px] text-white opacity-80 transition-all duration-250 ease-in group-data-[state=open]:-rotate-180 group-hover:opacity-100"
								aria-hidden
							/>
						</RadixNavigationMenu.Trigger>
						<RadixNavigationMenu.Content className="absolute left-0 top-0 w-full z-50 data-[motion=from-end]:animate-enterFromRight data-[motion=from-start]:animate-enterFromLeft data-[motion=to-end]:animate-exitToRight data-[motion=to-start]:animate-exitToLeft sm:w-auto">
							<ul className="one m-0 grid list-none gap-x-2.5 p-[22px] sm:w-[550px] sm:grid-cols-[0.75fr_1fr] bg-black/80 backdrop-blur-xl rounded-lg">
								<li className="row-span-3 grid">
									<RadixNavigationMenu.Link asChild>
										<a
											className="flex h-full w-full select-none flex-col justify-end rounded-lg p-[25px] no-underline outline-none"
											style={{
												backgroundImage: "url('/blog/images/girl.png')",
												backgroundSize: "cover",
												backgroundPosition: "center",
												backgroundRepeat: "no-repeat"
											}}
											href="/docs/getting-started"
										>
											
										</a>
									</RadixNavigationMenu.Link>
								</li>

								<ListItem
									title="Getting Started"
									href="/docs/getting-started"
								>
									Quick setup guide
								</ListItem>
								<ListItem
									title="API Reference"
									href="/docs/api"
								>
									Developer documentation
								</ListItem>
								<ListItem title="Integrations" href="/docs/integrations">
									Connect your tools
								</ListItem>
							</ul>
						</RadixNavigationMenu.Content>
					</RadixNavigationMenu.Item> */}

					<RadixNavigationMenu.Item>
						<RadixNavigationMenu.Trigger className="group flex select-none items-center justify-center gap-1 rounded px-[6px] py-1 text-[14px] font-medium leading-[1.24] tracking-[-0.02em] text-white opacity-80 outline-none hover:opacity-100 transition-opacity">
							Help{" "}
							<CaretDownIcon
								className="relative w-[14px] h-[14px] text-white opacity-80 transition-all duration-250 ease-in group-data-[state=open]:-rotate-180 group-hover:opacity-100"
								aria-hidden
							/>
						</RadixNavigationMenu.Trigger>
						<RadixNavigationMenu.Content className="absolute left-0 top-0 w-full z-50 data-[motion=from-end]:animate-enterFromRight data-[motion=from-start]:animate-enterFromLeft data-[motion=to-end]:animate-exitToRight data-[motion=to-start]:animate-exitToLeft sm:w-auto">
							<ul className="one m-0 grid list-none gap-x-2.5 p-[22px] sm:w-[550px] sm:grid-cols-[0.75fr_1fr] bg-black/80 backdrop-blur-xl rounded-lg">
								<li className="row-span-3 grid">
									<RadixNavigationMenu.Link asChild>
										<a
											className="flex h-full w-full select-none flex-col justify-end rounded-lg p-[25px] no-underline outline-none"
											style={{
												backgroundImage: "url('/crown.jpeg')",
												backgroundSize: "cover",
												backgroundPosition: "center",
												backgroundRepeat: "no-repeat"
											}}
											href="/help/support"
										>
											
										</a>
									</RadixNavigationMenu.Link>
								</li>

								<ListItem
									title="Support Center"
									href="/help/support"
								>
									Find help quickly
								</ListItem>
								<ListItem
									title="Community"
									href="/help/community"
								>
									Join the discussion
								</ListItem>
								<ListItem
									title="Contact Us"
									href="/help/contact"
								>
									Get in touch
								</ListItem>
							</ul>
						</RadixNavigationMenu.Content>
					</RadixNavigationMenu.Item>

					<RadixNavigationMenu.Item>
						<RadixNavigationMenu.Link
							className="block select-none rounded px-[6px] py-1 text-[14px] font-medium leading-[1.24] tracking-[-0.02em] text-white opacity-80 no-underline outline-none hover:opacity-100 transition-opacity"
							href="/pricing"
						>
							Pricing
						</RadixNavigationMenu.Link>
					</RadixNavigationMenu.Item>
				</RadixNavigationMenu.List>
			</div>

			{/* Action Buttons */}
			<div className="flex items-center justify-end gap-2">
				<Link 
					to="/login"
					className="flex items-center gap-2 rounded-[10px] px-4 py-1 h-9 text-[14px] font-medium leading-[1.24] tracking-[-0.02em] text-white no-underline outline-none hover:bg-white/10 transition-colors"
				>
					Sign In
				</Link>
				<Link 
					to="/login"
					className="flex items-center gap-2 rounded-[10px] px-4 py-1 h-9 bg-white text-[14px] font-medium leading-[1.43] text-[#262626] no-underline outline-none hover:bg-white/90 transition-colors"
				>
					Get Started
				</Link>
			</div>

			<div className="perspective-[2000px] absolute left-0 top-full flex w-full justify-center z-50">
				<RadixNavigationMenu.Viewport className="relative h-[var(--radix-navigation-menu-viewport-height)] w-full origin-[top_center] overflow-hidden rounded-lg bg-black/80 backdrop-blur-xl border border-white/10 transition-[width,_height] duration-300 data-[state=closed]:animate-scaleOut data-[state=open]:animate-scaleIn sm:w-[var(--radix-navigation-menu-viewport-width)] z-50" />
			</div>
		</RadixNavigationMenu.Root>
	);
};

const ListItem = React.forwardRef<
	React.ElementRef<'a'>,
	React.ComponentPropsWithoutRef<'a'> & {
		title: string;
	}
>(({ className, children, title, ...props }, forwardedRef) => (
	<li>
		<RadixNavigationMenu.Link asChild>
			<a
				className={classNames(
					"block select-none rounded-lg p-3 text-[14px] leading-[1.4] tracking-[-0.013em] no-underline outline-none transition-colors hover:bg-[#333333]",
					className,
				)}
				{...props}
				ref={forwardedRef}
			>
				<div className="mb-[5px] font-medium leading-[1.2] text-white">
					{title}
				</div>
				<p className="leading-[1.4] text-white/60">{children}</p>
			</a>
		</RadixNavigationMenu.Link>
	</li>
));

ListItem.displayName = 'ListItem';

export default NavigationMenu;
