import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Mic,
  X,
  Clock,
  Smile,
  Cat,
  Apple,
  Activity,
  Car,
  Lightbulb,
  Heart,
  Flag,
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSound } from '@/shared/context/sound-context';

export interface EmojiItem {
  id: string;
  native: string;
  name: string;
  keywords: string[];
}

export interface EmojiCategory {
  id: string;
  name: string;
  emojis: EmojiItem[];
}

export interface AppleEmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: EmojiItem) => void;
}

// --- LOCAL STORAGE STORE ---
class RecentStore {
  static KEY = 'blakor_apple_emoji_recent';
  static MAX = 50;

  static get(): string[] {
    try {
      if (typeof window === 'undefined') return [];
      return JSON.parse(localStorage.getItem(this.KEY) || '[]') || [];
    } catch {
      return [];
    }
  }

  static add(emoji: string) {
    try {
      if (typeof window === 'undefined') return;
      let recent = this.get();
      recent = [emoji, ...recent.filter((e) => e !== emoji)].slice(0, this.MAX);
      localStorage.setItem(this.KEY, JSON.stringify(recent));
    } catch {
      // Ignored
    }
  }
}

// --- EMOJIS DATASET ---
export const FULL_EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    name: 'Smileys & Personas',
    emojis: [
      { id: '1', native: '😀', name: 'Grinning Face', keywords: ['smile', 'happy'] },
      { id: '2', native: '😃', name: 'Smiling Face with Big Eyes', keywords: ['happy', 'smile'] },
      { id: '3', native: '😄', name: 'Smiling Face with Heart-Eyes', keywords: ['love', 'adoring'] },
      { id: '4', native: '😁', name: 'Beaming Face with Smiling Eyes', keywords: ['happy'] },
      { id: '5', native: '😆', name: 'Grinning Squinting Face', keywords: ['laugh'] },
      { id: '6', native: '😅', name: 'Grinning Face with Sweat', keywords: ['nervous'] },
      { id: '7', native: '🤣', name: 'Rolling on the Floor Laughing', keywords: ['funny', 'laugh'] },
      { id: '8', native: '😂', name: 'Face with Tears of Joy', keywords: ['laugh', 'cry'] },
      { id: '9', native: '🙂', name: 'Slightly Smiling Face', keywords: ['smile'] },
      { id: '10', native: '🙃', name: 'Upside-Down Face', keywords: ['silly'] },
      { id: '11', native: '😉', name: 'Winking Face', keywords: ['flirt'] },
      { id: '12', native: '😊', name: 'Smiling Face with Smiling Eyes', keywords: ['blush'] },
      { id: '13', native: '😇', name: 'Smiling Face with Halo', keywords: ['angel'] },
      { id: '14', native: '🥰', name: 'Smiling Face with Hearts', keywords: ['love'] },
      { id: '15', native: '😍', name: 'Smiling Face with Heart-Eyes', keywords: ['love'] },
      { id: '16', native: '🤩', name: 'Star-Struck', keywords: ['excited'] },
      { id: '17', native: '😘', name: 'Face Blowing a Kiss', keywords: ['kiss'] },
      { id: '18', native: '😗', name: 'Kissing Face', keywords: ['kiss'] },
      { id: '19', native: '☺️', name: 'Smiling Face', keywords: ['happy'] },
      { id: '20', native: '😚', name: 'Kissing Face with Closed Eyes', keywords: ['kiss'] },
      { id: '21', native: '😙', name: 'Kissing Face with Smiling Eyes', keywords: ['kiss'] },
      { id: '22', native: '😋', name: 'Face Savoring Food', keywords: ['yum'] },
      { id: '23', native: '😛', name: 'Face with Tongue', keywords: ['tongue'] },
      { id: '24', native: '😜', name: 'Winking Face with Tongue', keywords: ['silly'] },
      { id: '25', native: '🤪', name: 'Zany Face', keywords: ['crazy'] },
      { id: '26', native: '😝', name: 'Squinting Face with Tongue', keywords: ['silly'] },
      { id: '27', native: '🤑', name: 'Money-Mouth Face', keywords: ['rich'] },
      { id: '28', native: '🤗', name: 'Hugging Face', keywords: ['hug'] },
      { id: '29', native: '🤭', name: 'Face with Hand Over Mouth', keywords: ['quiet'] },
      { id: '30', native: '🤫', name: 'Shushing Face', keywords: ['quiet'] },
      { id: '31', native: '🤔', name: 'Thinking Face', keywords: ['think'] },
      { id: '32', native: '🤐', name: 'Zipper-Mouth Face', keywords: ['secret'] },
      { id: '33', native: '🤨', name: 'Face with Raised Eyebrow', keywords: ['query'] },
      { id: '34', native: '😐', name: 'Neutral Face', keywords: ['meh'] },
      { id: '35', native: '😑', name: 'Expressionless Face', keywords: ['meh'] },
      { id: '36', native: '😶', name: 'Face Without Mouth', keywords: ['quiet'] },
      { id: '37', native: '😏', name: 'Smirking Face', keywords: ['sly'] },
      { id: '38', native: '😒', name: 'Unamused Face', keywords: ['meh'] },
      { id: '39', native: '🙄', name: 'Face with Rolling Eyes', keywords: ['annoyed'] },
      { id: '40', native: '😬', name: 'Grimacing Face', keywords: ['awkward'] },
      { id: '41', native: '🤥', name: 'Lying Face', keywords: ['lie'] },
      { id: '42', native: '😌', name: 'Relieved Face', keywords: ['relief'] },
      { id: '43', native: '😔', name: 'Pensive Face', keywords: ['sad'] },
      { id: '44', native: '😪', name: 'Sleepy Face', keywords: ['tired'] },
      { id: '45', native: '🤤', name: 'Drooling Face', keywords: ['sleep'] },
      { id: '46', native: '😴', name: 'Sleeping Face', keywords: ['sleep'] },
      { id: '47', native: '😷', name: 'Face with Medical Mask', keywords: ['sick'] },
      { id: '48', native: '🤒', name: 'Face with Thermometer', keywords: ['sick'] },
      { id: '49', native: '👍', name: 'Thumbs Up', keywords: ['yes', 'ok'] },
      { id: '50', native: '👏', name: 'Clapping Hands', keywords: ['congrats', 'applause'] },
    ],
  },
  {
    id: 'animals',
    name: 'Animales & Naturaleza',
    emojis: [
      { id: 'a1', native: '🐶', name: 'Dog Face', keywords: ['pet'] },
      { id: 'a2', native: '🐱', name: 'Cat Face', keywords: ['pet'] },
      { id: 'a3', native: '🐭', name: 'Mouse Face', keywords: ['animal'] },
      { id: 'a4', native: '🐹', name: 'Hamster Face', keywords: ['pet'] },
      { id: 'a5', native: '🐰', name: 'Rabbit Face', keywords: ['pet'] },
      { id: 'a6', native: '🦊', name: 'Fox', keywords: ['wild'] },
      { id: 'a7', native: '🐻', name: 'Bear', keywords: ['wild'] },
      { id: 'a8', native: '🐼', name: 'Panda', keywords: ['wild'] },
      { id: 'a9', native: '🐨', name: 'Koala', keywords: ['wild'] },
      { id: 'a10', native: '🐯', name: 'Tiger Face', keywords: ['wild'] },
      { id: 'a11', native: '🦁', name: 'Lion', keywords: ['wild'] },
      { id: 'a12', native: '🐮', name: 'Cow Face', keywords: ['farm'] },
      { id: 'a13', native: '🐷', name: 'Pig Face', keywords: ['farm'] },
      { id: 'a14', native: '🐸', name: 'Frog', keywords: ['wild'] },
      { id: 'a15', native: '🐵', name: 'Monkey Face', keywords: ['wild'] },
      { id: 'a16', native: '🐔', name: 'Chicken', keywords: ['farm'] },
      { id: 'a17', native: '🐧', name: 'Penguin', keywords: ['cold'] },
      { id: 'a18', native: '🐦', name: 'Bird', keywords: ['wild'] },
      { id: 'a19', native: '🐤', name: 'Baby Chick', keywords: ['farm'] },
      { id: 'a20', native: '🦆', name: 'Duck', keywords: ['wild'] },
      { id: 'a21', native: '🦅', name: 'Eagle', keywords: ['wild'] },
      { id: 'a22', native: '🦉', name: 'Owl', keywords: ['wild'] },
      { id: 'a23', native: '🦇', name: 'Bat', keywords: ['wild'] },
      { id: 'a24', native: '🐺', name: 'Wolf', keywords: ['wild'] },
      { id: 'a25', native: '🐗', name: 'Boar', keywords: ['wild'] },
      { id: 'a26', native: '🐴', name: 'Horse Face', keywords: ['farm'] },
      { id: 'a27', native: '🦄', name: 'Unicorn', keywords: ['magic'] },
      { id: 'a28', native: '🐝', name: 'Honeybee', keywords: ['bug', 'bee'] },
      { id: 'a29', native: '🐛', name: 'Bug', keywords: ['insect'] },
      { id: 'a30', native: '🦋', name: 'Butterfly', keywords: ['bug'] },
      { id: 'a31', native: '🐌', name: 'Snail', keywords: ['slow'] },
      { id: 'a32', native: '🐞', name: 'Lady Beetle', keywords: ['bug'] },
      { id: 'a33', native: '🐜', name: 'Ant', keywords: ['bug'] },
      { id: 'a34', native: '🕷️', name: 'Spider', keywords: ['bug'] },
      { id: 'a35', native: '🦂', name: 'Scorpion', keywords: ['wild'] },
      { id: 'a36', native: '🐢', name: 'Turtle', keywords: ['slow'] },
      { id: 'a37', native: '🐍', name: 'Snake', keywords: ['wild'] },
      { id: 'a38', native: '🦎', name: 'Lizard', keywords: ['wild'] },
      { id: 'a39', native: '🐙', name: 'Octopus', keywords: ['sea'] },
      { id: 'a40', native: '🦑', name: 'Squid', keywords: ['sea'] },
      { id: 'a41', native: '🐟', name: 'Fish', keywords: ['sea'] },
      { id: 'a42', native: '🐬', name: 'Dolphin', keywords: ['sea'] },
      { id: 'a43', native: '🐳', name: 'Spouting Whale', keywords: ['sea'] },
      { id: 'a44', native: '🦈', name: 'Shark', keywords: ['sea'] },
      { id: 'a45', native: '🌹', name: 'Rose', keywords: ['flower'] },
      { id: 'a46', native: '🌻', name: 'Sunflower', keywords: ['flower'] },
      { id: 'a47', native: '🌲', name: 'Evergreen Tree', keywords: ['nature'] },
      { id: 'a48', native: '🌵', name: 'Cactus', keywords: ['nature'] },
      { id: 'a49', native: '🍁', name: 'Maple Leaf', keywords: ['nature'] },
      { id: 'a50', native: '🍀', name: 'Four Leaf Clover', keywords: ['lucky'] },
    ],
  },
  {
    id: 'food',
    name: 'Comida & Bebida',
    emojis: [
      { id: 'f1', native: '🍎', name: 'Red Apple', keywords: ['fruit'] },
      { id: 'f2', native: '🍏', name: 'Green Apple', keywords: ['fruit'] },
      { id: 'f3', native: '🍐', name: 'Pear', keywords: ['fruit'] },
      { id: 'f4', native: '🍊', name: 'Tangerine', keywords: ['fruit'] },
      { id: 'f5', native: '🍋', name: 'Lemon', keywords: ['fruit'] },
      { id: 'f6', native: '🍌', name: 'Banana', keywords: ['fruit'] },
      { id: 'f7', native: '🍉', name: 'Watermelon', keywords: ['fruit'] },
      { id: 'f8', native: '🍇', name: 'Grapes', keywords: ['fruit'] },
      { id: 'f9', native: '🍓', name: 'Strawberry', keywords: ['fruit'] },
      { id: 'f10', native: '🍈', name: 'Melon', keywords: ['fruit'] },
      { id: 'f11', native: '🍒', name: 'Cherries', keywords: ['fruit'] },
      { id: 'f12', native: '🍑', name: 'Peach', keywords: ['fruit'] },
      { id: 'f13', native: '🍍', name: 'Pineapple', keywords: ['fruit'] },
      { id: 'f14', native: '🥥', name: 'Coconut', keywords: ['fruit'] },
      { id: 'f15', native: '🥝', name: 'Kiwi Fruit', keywords: ['fruit'] },
      { id: 'f16', native: '🍅', name: 'Tomato', keywords: ['veg'] },
      { id: 'f17', native: '🍆', name: 'Eggplant', keywords: ['veg'] },
      { id: 'f18', native: '🥑', name: 'Avocado', keywords: ['healthy'] },
      { id: 'f19', native: '🥦', name: 'Broccoli', keywords: ['veg'] },
      { id: 'f20', native: '🥒', name: 'Cucumber', keywords: ['veg'] },
      { id: 'f21', native: '🌽', name: 'Ear of Corn', keywords: ['veg'] },
      { id: 'f22', native: '🥕', name: 'Carrot', keywords: ['veg'] },
      { id: 'f23', native: '🥔', name: 'Potato', keywords: ['veg'] },
      { id: 'f24', native: '🥐', name: 'Croissant', keywords: ['bakery'] },
      { id: 'f25', native: '🍞', name: 'Bread', keywords: ['bakery'] },
      { id: 'f26', native: '🥖', name: 'Baguette', keywords: ['bakery'] },
      { id: 'f27', native: '🧀', name: 'Cheese Wedge', keywords: ['dairy'] },
      { id: 'f28', native: '🥚', name: 'Egg', keywords: ['dairy'] },
      { id: 'f29', native: '🥞', name: 'Pancakes', keywords: ['sweet'] },
      { id: 'f30', native: '🧇', name: 'Waffle', keywords: ['sweet'] },
      { id: 'f31', native: '🥓', name: 'Bacon', keywords: ['meat'] },
      { id: 'f32', native: '🍔', name: 'Hamburger', keywords: ['fast food'] },
      { id: 'f33', native: '🍟', name: 'French Fries', keywords: ['fast food'] },
      { id: 'f34', native: '🍕', name: 'Pizza', keywords: ['fast food'] },
      { id: 'f35', native: '🌭', name: 'Hot Dog', keywords: ['fast food'] },
      { id: 'f36', native: '🥪', name: 'Sandwich', keywords: ['fast food'] },
      { id: 'f37', native: '🌮', name: 'Taco', keywords: ['mexican'] },
      { id: 'f38', native: '🍣', name: 'Sushi', keywords: ['japanese'] },
      { id: 'f39', native: '🍚', name: 'Cooked Rice', keywords: ['japanese'] },
      { id: 'f40', native: '🍦', name: 'Soft Ice Cream', keywords: ['dessert'] },
      { id: 'f41', native: '🍪', name: 'Cookie', keywords: ['dessert'] },
      { id: 'f42', native: '🍰', name: 'Shortcake', keywords: ['dessert'] },
      { id: 'f43', native: '🍩', name: 'Doughnut', keywords: ['dessert'] },
      { id: 'f44', native: '🍫', name: 'Chocolate Bar', keywords: ['dessert'] },
      { id: 'f45', native: '🍬', name: 'Candy', keywords: ['sweet'] },
      { id: 'f46', native: '🍯', name: 'Honey Pot', keywords: ['sweet'] },
      { id: 'f47', native: '🥛', name: 'Glass of Milk', keywords: ['drink'] },
      { id: 'f48', native: '☕', name: 'Hot Beverage', keywords: ['drink', 'coffee'] },
      { id: 'f49', native: '🍵', name: 'Teacup Without Handle', keywords: ['drink', 'tea'] },
      { id: 'f50', native: '🍺', name: 'Beer Mug', keywords: ['drink'] },
    ],
  },
  {
    id: 'activities',
    name: 'Actividades & Deportes',
    emojis: [
      { id: 'ac1', native: '⚽', name: 'Soccer Ball', keywords: ['sports'] },
      { id: 'ac2', native: '🏀', name: 'Basketball', keywords: ['sports'] },
      { id: 'ac3', native: '🏈', name: 'American Football', keywords: ['sports'] },
      { id: 'ac4', native: '⚾', name: 'Baseball', keywords: ['sports'] },
      { id: 'ac5', native: '🥎', name: 'Softball', keywords: ['sports'] },
      { id: 'ac6', native: '🎾', name: 'Tennis', keywords: ['sports'] },
      { id: 'ac7', native: '🏐', name: 'Volleyball', keywords: ['sports'] },
      { id: 'ac8', native: '🏉', name: 'Rugby Football', keywords: ['sports'] },
      { id: 'ac9', native: '🎱', name: 'Pool 8 Ball', keywords: ['sports'] },
      { id: 'ac10', native: '🏓', name: 'Ping Pong', keywords: ['sports'] },
      { id: 'ac11', native: '🏸', name: 'Badminton', keywords: ['sports'] },
      { id: 'ac12', native: '🥊', name: 'Boxing Glove', keywords: ['sports'] },
      { id: 'ac13', native: '🥋', name: 'Martial Arts Uniform', keywords: ['sports'] },
      { id: 'ac14', native: '🛹', name: 'Skateboard', keywords: ['sports'] },
      { id: 'ac15', native: '🛼', name: 'Roller Skate', keywords: ['sports'] },
      { id: 'ac16', native: '🥅', name: 'Goal Net', keywords: ['sports'] },
      { id: 'ac17', native: '🏹', name: 'Bow and Arrow', keywords: ['sports'] },
      { id: 'ac18', native: '🎣', name: 'Fishing Pole', keywords: ['hobby'] },
      { id: 'ac19', native: '🎮', name: 'Video Game', keywords: ['play', 'gaming'] },
      { id: 'ac20', native: '🏆', name: 'Trophy', keywords: ['win'] },
      { id: 'ac21', native: '🥇', name: '1st Place Medal', keywords: ['win'] },
      { id: 'ac22', native: '🥈', name: '2nd Place Medal', keywords: ['win'] },
      { id: 'ac23', native: '🥉', name: '3rd Place Medal', keywords: ['win'] },
      { id: 'ac24', native: '🎸', name: 'Guitar', keywords: ['music'] },
      { id: 'ac25', native: '🎹', name: 'Musical Keyboard', keywords: ['music'] },
      { id: 'ac26', native: '🎻', name: 'Violin', keywords: ['music'] },
      { id: 'ac27', native: '🥁', name: 'Drum', keywords: ['music'] },
      { id: 'ac28', native: '🎺', name: 'Trumpet', keywords: ['music'] },
      { id: 'ac29', native: '🎤', name: 'Microphone', keywords: ['sing'] },
      { id: 'ac30', native: '🎧', name: 'Headphones', keywords: ['music'] },
      { id: 'ac31', native: '🎨', name: 'Artist Palette', keywords: ['draw', 'art'] },
      { id: 'ac32', native: '🎬', name: 'Clapper Board', keywords: ['movie'] },
      { id: 'ac33', native: '🎫', name: 'Ticket', keywords: ['movie'] },
      { id: 'ac34', native: '♟️', name: 'Chess Pawn', keywords: ['play'] },
      { id: 'ac35', native: '🎯', name: 'Bullseye', keywords: ['play'] },
      { id: 'ac36', native: '🪀', name: 'Yo-Yo', keywords: ['play'] },
      { id: 'ac37', native: '🪁', name: 'Kite', keywords: ['play'] },
      { id: 'ac38', native: '🧩', name: 'Puzzle Piece', keywords: ['play'] },
      { id: 'ac39', native: '🏃', name: 'Person Running', keywords: ['sports'] },
      { id: 'ac40', native: '🚴', name: 'Person Biking', keywords: ['sports'] },
      { id: 'ac41', native: '🏋️', name: 'Person Lifting Weights', keywords: ['sports'] },
      { id: 'ac42', native: '🏊', name: 'Person Swimming', keywords: ['sports'] },
      { id: 'ac43', native: '🤸', name: 'Person Cartwheeling', keywords: ['sports'] },
      { id: 'ac44', native: '🧗', name: 'Person Climbing', keywords: ['sports'] },
      { id: 'ac45', native: '💃', name: 'Woman Dancing', keywords: ['dance'] },
      { id: 'ac46', native: '🎳', name: 'Bowling', keywords: ['sports'] },
      { id: 'ac47', native: '⛳', name: 'Flag in Hole', keywords: ['sports'] },
      { id: 'ac48', native: '🛷', name: 'Sled', keywords: ['sports'] },
      { id: 'ac49', native: '🎿', name: 'Skis', keywords: ['sports'] },
      { id: 'ac50', native: '⛸️', name: 'Ice Skate', keywords: ['sports'] },
    ],
  },
  {
    id: 'travel',
    name: 'Viajes & Lugares',
    emojis: [
      { id: 't1', native: '🚗', name: 'Automobile', keywords: ['car'] },
      { id: 't2', native: '🚕', name: 'Taxi', keywords: ['car'] },
      { id: 't3', native: '🚙', name: 'Sport Utility Vehicle', keywords: ['car'] },
      { id: 't4', native: '🚌', name: 'Bus', keywords: ['vehicle'] },
      { id: 't5', native: '🚎', name: 'Trolleybus', keywords: ['vehicle'] },
      { id: 't6', native: '🏎️', name: 'Racing Car', keywords: ['car'] },
      { id: 't7', native: '🚓', name: 'Police Car', keywords: ['car'] },
      { id: 't8', native: '🚑', name: 'Ambulance', keywords: ['vehicle'] },
      { id: 't9', native: '🚒', name: 'Fire Engine', keywords: ['vehicle'] },
      { id: 't10', native: '🚐', name: 'Minibus', keywords: ['vehicle'] },
      { id: 't11', native: '🚚', name: 'Delivery Truck', keywords: ['vehicle'] },
      { id: 't12', native: '🚜', name: 'Tractor', keywords: ['vehicle'] },
      { id: 't13', native: '🛵', name: 'Motor Scooter', keywords: ['vehicle'] },
      { id: 't14', native: '🚲', name: 'Bicycle', keywords: ['vehicle'] },
      { id: 't15', native: '🚂', name: 'Locomotive', keywords: ['vehicle'] },
      { id: 't16', native: '✈️', name: 'Airplane', keywords: ['flight'] },
      { id: 't17', native: '🚀', name: 'Rocket', keywords: ['space'] },
      { id: 't18', native: '🛸', name: 'Flying Saucer', keywords: ['alien'] },
      { id: 't19', native: '🚁', name: 'Helicopter', keywords: ['flight'] },
      { id: 't20', native: '🪂', name: 'Parachute', keywords: ['flight'] },
      { id: 't21', native: '⛵', name: 'Sailboat', keywords: ['sea'] },
      { id: 't22', native: '🚢', name: 'Ship', keywords: ['sea'] },
      { id: 't23', native: '⚓', name: 'Anchor', keywords: ['sea'] },
      { id: 't24', native: '⛽', name: 'Fuel Pump', keywords: ['gas'] },
      { id: 't25', native: '🚨', name: 'Police Car Light', keywords: ['alarm'] },
      { id: 't26', native: '🛑', name: 'Stop Sign', keywords: ['warning'] },
      { id: 't27', native: '🏠', name: 'House', keywords: ['building'] },
      { id: 't28', native: '🏢', name: 'Office Building', keywords: ['building'] },
      { id: 't29', native: '🏣', name: 'Japanese Post Office', keywords: ['building'] },
      { id: 't30', native: '🏥', name: 'Hospital', keywords: ['building'] },
      { id: 't31', native: '🏦', name: 'Bank', keywords: ['building'] },
      { id: 't32', native: '🏨', name: 'Hotel', keywords: ['building'] },
      { id: 't33', native: '🏫', name: 'School', keywords: ['building'] },
      { id: 't34', native: '🏟️', name: 'Stadium', keywords: ['building'] },
      { id: 't35', native: '⛪', name: 'Church', keywords: ['building'] },
      { id: 't36', native: '🕌', name: 'Mosque', keywords: ['building'] },
      { id: 't37', native: '🕍', name: 'Synagogue', keywords: ['building'] },
      { id: 't38', native: '⛺', name: 'Tent', keywords: ['camp'] },
      { id: 't39', native: '🎡', name: 'Ferris Wheel', keywords: ['park'] },
      { id: 't40', native: '🎢', name: 'Roller Coaster', keywords: ['park'] },
      { id: 't41', native: '🗽', name: 'Statue of Liberty', keywords: ['landmark'] },
      { id: 't42', native: '🗼', name: 'Tokyo Tower', keywords: ['landmark'] },
      { id: 't43', native: '🗻', name: 'Mount Fuji', keywords: ['mountain'] },
      { id: 't44', native: '🌋', name: 'Volcano', keywords: ['nature'] },
      { id: 't45', native: '🏜️', name: 'Desert', keywords: ['nature'] },
      { id: 't46', native: '🏖️', name: 'Beach with Umbrella', keywords: ['summer'] },
      { id: 't47', native: '🏝️', name: 'Desert Island', keywords: ['sea'] },
      { id: 't48', native: '🌈', name: 'Rainbow', keywords: ['nature'] },
      { id: 't49', native: '☀️', name: 'Sun', keywords: ['nature'] },
      { id: 't50', native: '☁️', name: 'Cloud', keywords: ['nature'] },
    ],
  },
  {
    id: 'objects',
    name: 'Objetos & Tecnología',
    emojis: [
      { id: 'o1', native: '⌚', name: 'Watch', keywords: ['time'] },
      { id: 'o2', native: '📱', name: 'Mobile Phone', keywords: ['tech'] },
      { id: 'o3', native: '💻', name: 'Laptop', keywords: ['tech'] },
      { id: 'o4', native: '⌨️', name: 'Keyboard', keywords: ['tech'] },
      { id: 'o5', native: '🖥️', name: 'Desktop Computer', keywords: ['tech'] },
      { id: 'o6', native: '🖨️', name: 'Printer', keywords: ['tech'] },
      { id: 'o7', native: '🖱️', name: 'Computer Mouse', keywords: ['tech'] },
      { id: 'o8', native: '🕹️', name: 'Joystick', keywords: ['play'] },
      { id: 'o9', native: '📷', name: 'Camera', keywords: ['photo'] },
      { id: 'o10', native: '📹', name: 'Video Camera', keywords: ['photo'] },
      { id: 'o11', native: '📽️', name: 'Movie Projector', keywords: ['photo'] },
      { id: 'o12', native: '☎️', name: 'Telephone', keywords: ['tech'] },
      { id: 'o13', native: '📺', name: 'Television', keywords: ['tech'] },
      { id: 'o14', native: '📻', name: 'Radio', keywords: ['tech'] },
      { id: 'o15', native: '💡', name: 'Light Bulb', keywords: ['idea'] },
      { id: 'o16', native: '🔦', name: 'Flashlight', keywords: ['tool'] },
      { id: 'o17', native: '🕯️', name: 'Candle', keywords: ['light'] },
      { id: 'o18', native: '📖', name: 'Open Book', keywords: ['study'] },
      { id: 'o19', native: '📕', name: 'Closed Book', keywords: ['study'] },
      { id: 'o20', native: '✉️', name: 'Envelope', keywords: ['mail'] },
      { id: 'o21', native: '📦', name: 'Package', keywords: ['mail'] },
      { id: 'o22', native: '✏️', name: 'Pencil', keywords: ['study'] },
      { id: 'o23', native: '🖊️', name: 'Pen', keywords: ['study'] },
      { id: 'o24', native: '🔑', name: 'Key', keywords: ['lock'] },
      { id: 'o25', native: '🔨', name: 'Hammer', keywords: ['tool'] },
      { id: 'o26', native: '🛡️', name: 'Shield', keywords: ['security'] },
      { id: 'o27', native: '💸', name: 'Money with Wings', keywords: ['money'] },
      { id: 'o28', native: '💵', name: 'Dollar Banknote', keywords: ['money'] },
      { id: 'o29', native: '🪙', name: 'Coin', keywords: ['money'] },
      { id: 'o30', native: '💳', name: 'Credit Card', keywords: ['money'] },
      { id: 'o31', native: '✂️', name: 'Scissors', keywords: ['tool'] },
      { id: 'o32', native: '🔧', name: 'Wrench', keywords: ['tool'] },
      { id: 'o33', native: '🪛', name: 'Screwdriver', keywords: ['tool'] },
      { id: 'o34', native: '🪜', name: 'Ladder', keywords: ['tool'] },
      { id: 'o35', native: '🧰', name: 'Toolbox', keywords: ['tool'] },
      { id: 'o36', native: '🧲', name: 'Magnet', keywords: ['tool'] },
      { id: 'o37', native: '💉', name: 'Syringe', keywords: ['medical'] },
      { id: 'o38', native: '💊', name: 'Pill', keywords: ['medical'] },
      { id: 'o39', native: '🩺', name: 'Stethoscope', keywords: ['medical'] },
      { id: 'o40', native: '🔭', name: 'Telescope', keywords: ['science'] },
      { id: 'o41', native: '🔬', name: 'Microscope', keywords: ['science'] },
      { id: 'o42', native: '🌂', name: 'Closed Umbrella', keywords: ['weather'] },
      { id: 'o43', native: '💼', name: 'Briefcase', keywords: ['work'] },
      { id: 'o44', native: '📋', name: 'Clipboard', keywords: ['work'] },
      { id: 'o45', native: '👓', name: 'Glasses', keywords: ['fashion'] },
      { id: 'o46', native: '🧺', name: 'Basket', keywords: ['home'] },
      { id: 'o47', native: '🪞', name: 'Mirror', keywords: ['home'] },
      { id: 'o48', native: '🧼', name: 'Soap', keywords: ['home'] },
      { id: 'o49', native: '🧽', name: 'Sponge', keywords: ['home'] },
      { id: 'o50', native: '🧹', name: 'Broom', keywords: ['home'] },
    ],
  },
  {
    id: 'symbols',
    name: 'Símbolos',
    emojis: [
      { id: 's1', native: '❤️', name: 'Red Heart', keywords: ['love'] },
      { id: 's2', native: '🧡', name: 'Orange Heart', keywords: ['love'] },
      { id: 's3', native: '💛', name: 'Yellow Heart', keywords: ['love'] },
      { id: 's4', native: '💚', name: 'Green Heart', keywords: ['love'] },
      { id: 's5', native: '💙', name: 'Blue Heart', keywords: ['love'] },
      { id: 's6', native: '💜', name: 'Purple Heart', keywords: ['love'] },
      { id: 's7', native: '🖤', name: 'Black Heart', keywords: ['love'] },
      { id: 's8', native: '🤍', name: 'White Heart', keywords: ['love'] },
      { id: 's9', native: '🤎', name: 'Brown Heart', keywords: ['love'] },
      { id: 's10', native: '💔', name: 'Broken Heart', keywords: ['sad'] },
      { id: 's11', native: '❣️', name: 'Heart Exclamation', keywords: ['love'] },
      { id: 's12', native: '💕', name: 'Two Hearts', keywords: ['love'] },
      { id: 's13', native: '💞', name: 'Revolving Hearts', keywords: ['love'] },
      { id: 's14', native: '💓', name: 'Beating Heart', keywords: ['love'] },
      { id: 's15', native: '💗', name: 'Growing Heart', keywords: ['love'] },
      { id: 's16', native: '💖', name: 'Sparkling Heart', keywords: ['love'] },
      { id: 's17', native: '💘', name: 'Heart with Arrow', keywords: ['love'] },
      { id: 's18', native: '💝', name: 'Heart with Ribbon', keywords: ['love'] },
      { id: 's20', native: '💟', name: 'Heart Decoration', keywords: ['love'] },
      { id: 's21', native: '💤', name: 'Zzz', keywords: ['sleep'] },
      { id: 's22', native: '💥', name: 'Collision', keywords: ['warning'] },
      { id: 's23', native: '♨️', name: 'Hot Springs', keywords: ['symbol'] },
      { id: 's24', native: '🛑', name: 'Stop Sign', keywords: ['warning'] },
      { id: 's25', native: '⚠️', name: 'Warning', keywords: ['warning'] },
      { id: 's26', native: '☣️', name: 'Biohazard', keywords: ['warning'] },
      { id: 's27', native: '☢️', name: 'Radioactive', keywords: ['warning'] },
      { id: 's28', native: '🔇', name: 'Muted Speaker', keywords: ['sound'] },
      { id: 's29', native: '🔈', name: 'Speaker Low Volume', keywords: ['sound'] },
      { id: 's30', native: '🔊', name: 'Speaker High Volume', keywords: ['sound'] },
      { id: 's31', native: '🎵', name: 'Musical Note', keywords: ['music'] },
      { id: 's32', native: '🎶', name: 'Musical Notes', keywords: ['music'] },
      { id: 's33', native: '➕', name: 'Plus Sign', keywords: ['math'] },
      { id: 's34', native: '➖', name: 'Minus Sign', keywords: ['math'] },
      { id: 's35', native: '✖️', name: 'Multiply Sign', keywords: ['math'] },
      { id: 's36', native: '➗', name: 'Divide Sign', keywords: ['math'] },
      { id: 's37', native: '❓', name: 'Question Mark', keywords: ['query'] },
      { id: 's38', native: '❗', name: 'Exclamation Mark', keywords: ['warning'] },
      { id: 's39', native: '💯', name: 'Perfect Score', keywords: ['perfect'] },
      { id: 's40', native: '♻️', name: 'Recycle', keywords: ['green'] },
      { id: 's41', native: '🔱', name: 'Trident', keywords: ['symbol'] },
      { id: 's42', native: '⭕', name: 'Circle', keywords: ['symbol'] },
      { id: 's43', native: '❌', name: 'Cross', keywords: ['no'] },
      { id: 's44', native: '☑️', name: 'Check Box', keywords: ['yes'] },
      { id: 's45', native: '✔️', name: 'Check', keywords: ['yes'] },
      { id: 's46', native: '↗️', name: 'Up-Right', keywords: ['arrow'] },
      { id: 's47', native: '⬇️', name: 'Down', keywords: ['arrow'] },
      { id: 's48', native: '🔄', name: 'Refresh', keywords: ['refresh'] },
      { id: 's49', native: '🇺🇳', name: 'UN Flag', keywords: ['flag'] },
      { id: 's50', native: '♾️', name: 'Infinity', keywords: ['math'] },
    ],
  },
  {
    id: 'flags',
    name: 'Banderas del Mundo',
    emojis: [
      { id: 'fl1', native: '🇺🇸', name: 'Flag: United States', keywords: ['usa', 'america'] },
      { id: 'fl2', native: '🇬🇧', name: 'Flag: United Kingdom', keywords: ['britain', 'uk'] },
      { id: 'fl3', native: '🇨🇦', name: 'Flag: Canada', keywords: ['canada'] },
      { id: 'fl4', native: '🇦🇺', name: 'Flag: Australia', keywords: ['australia'] },
      { id: 'fl5', native: '🇯🇵', name: 'Flag: Japan', keywords: ['japan'] },
      { id: 'fl6', native: '🇩🇪', name: 'Flag: Germany', keywords: ['germany'] },
      { id: 'fl7', native: '🇫🇷', name: 'Flag: France', keywords: ['france'] },
      { id: 'fl8', native: '🇮🇹', name: 'Flag: Italy', keywords: ['italy'] },
      { id: 'fl9', native: '🇧🇷', name: 'Flag: Brazil', keywords: ['brazil'] },
      { id: 'fl10', native: '🇮🇳', name: 'Flag: India', keywords: ['india'] },
      { id: 'fl11', native: '🇪🇸', name: 'Flag: Spain', keywords: ['spain'] },
      { id: 'fl12', native: '🇲🇽', name: 'Flag: Mexico', keywords: ['mexico'] },
      { id: 'fl13', native: '🇦🇷', name: 'Flag: Argentina', keywords: ['argentina'] },
      { id: 'fl14', native: '🇨🇱', name: 'Flag: Chile', keywords: ['chile'] },
      { id: 'fl15', native: '🇨🇴', name: 'Flag: Colombia', keywords: ['colombia'] },
      { id: 'fl16', native: '🇵🇪', name: 'Flag: Peru', keywords: ['peru'] },
      { id: 'fl17', native: '🇨🇭', name: 'Flag: Switzerland', keywords: ['swiss'] },
      { id: 'fl18', native: '🇳🇱', name: 'Flag: Netherlands', keywords: ['dutch'] },
      { id: 'fl19', native: '🇸🇪', name: 'Flag: Sweden', keywords: ['sweden'] },
      { id: 'fl20', native: '🇳🇴', name: 'Flag: Norway', keywords: ['norway'] },
    ],
  },
];

// --- SUB-COMPONENTS ---
const EmojiSearch = ({
  value,
  onChange,
  isDark,
  toggleTheme,
}: {
  value: string;
  onChange: (val: string) => void;
  isDark: boolean;
  toggleTheme: () => void;
}) => {
  const [isListening, setIsListening] = useState(false);

  const handleVoice = () => {
    setIsListening(true);
    if ('webkitSpeechRecognition' in window) {
      const rec = new (window as any).webkitSpeechRecognition();
      rec.onresult = (e: any) => {
        onChange(e.results[0][0].transcript);
        setIsListening(false);
      };
      rec.onerror = () => setIsListening(false);
      rec.start();
    } else {
      setIsListening(false);
    }
  };

  return (
    <div className="sticky top-0 z-20 px-3 py-2.5 bg-background/80 backdrop-blur-xl border-b border-border/60">
      <div className="flex items-center w-full h-9 bg-card rounded-xl shadow-xs border border-border overflow-hidden">
        <div className="pl-2.5 text-muted-foreground">
          <Search className="h-3.5 w-3.5" />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Buscar emoji..."
          className="flex-1 w-full h-full px-2.5 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        <button
          type="button"
          onClick={handleVoice}
          title="Búsqueda por voz"
          className={cn(
            'p-1.5 transition-colors cursor-pointer',
            isListening ? 'text-destructive animate-pulse' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Mic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className="p-1.5 border-l border-border text-muted-foreground hover:text-foreground cursor-pointer focus:outline-hidden"
          title="Alternar Modo Oscuro/Claro"
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
};

const EmojiGrid = ({
  categories,
  searchQuery,
  onSelect,
  activeCategory,
  onScrollCategory,
}: {
  categories: EmojiCategory[];
  searchQuery: string;
  onSelect: (emoji: EmojiItem) => void;
  activeCategory: string;
  onScrollCategory: (id: string) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      emojis: cat.emojis.filter(
        (e) =>
          e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.keywords.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    }))
    .filter((cat) => cat.emojis.length > 0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const offsets = Object.entries(categoryRefs.current).map(([id, ref]) => ({
        id,
        top: ref ? ref.getBoundingClientRect().top - container.getBoundingClientRect().top : Infinity,
      }));
      const current = offsets.filter((o) => o.top <= 40).pop();
      if (current && current.id !== activeCategory) {
        onScrollCategory(current.id);
      }
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeCategory, onScrollCategory]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-3 pb-14 custom-scrollbar scroll-smooth">
      {filteredCategories.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
          <p className="text-xs font-medium">No se encontraron emojis coincidentes</p>
        </div>
      ) : (
        filteredCategories.map((category) => (
          <div
            key={category.id}
            ref={(el) => {
              categoryRefs.current[category.id] = el;
            }}
            className="mb-4"
            id={`category-${category.id}`}
          >
            <h3 className="sticky top-0 z-10 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-background/90 backdrop-blur-md">
              {category.name}
            </h3>
            <div className="grid grid-cols-7 gap-1 mt-1.5">
              {category.emojis.map((emoji) => (
                <button
                  key={emoji.id}
                  type="button"
                  onClick={() => onSelect(emoji)}
                  title={emoji.name}
                  className="flex items-center justify-center w-8 h-8 text-xl rounded-lg hover:bg-muted/70 hover:scale-120 active:scale-90 transition-all duration-150 cursor-pointer select-none"
                >
                  {emoji.native}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const CategoryTabs = ({
  activeCategory,
  onSelect,
}: {
  activeCategory: string;
  onSelect: (categoryId: string) => void;
}) => {
  const tabs = [
    { id: 'recent', icon: Clock, label: 'Recientes' },
    { id: 'smileys', icon: Smile, label: 'Smileys' },
    { id: 'animals', icon: Cat, label: 'Animales' },
    { id: 'food', icon: Apple, label: 'Comida' },
    { id: 'activities', icon: Activity, label: 'Actividades' },
    { id: 'travel', icon: Car, label: 'Viajes' },
    { id: 'objects', icon: Lightbulb, label: 'Objetos' },
    { id: 'symbols', icon: Heart, label: 'Símbolos' },
    { id: 'flags', icon: Flag, label: 'Banderas' },
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 px-2 py-1.5 bg-background/90 backdrop-blur-xl border-t border-border/60 flex justify-between items-center">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeCategory === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            className={cn(
              'relative p-1.5 rounded-full transition-colors cursor-pointer',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={tab.label}
          >
            {isActive && <div className="absolute inset-0 bg-primary/10 rounded-full" />}
            <Icon className="h-3.5 w-3.5 relative z-10" />
          </button>
        );
      })}
    </div>
  );
};

// --- MAIN EXPORTED COMPONENT ---
export const AppleEmojiPicker: React.FC<AppleEmojiPickerProps> = ({
  isOpen,
  onClose,
  onEmojiSelect,
}) => {
  const { play } = useSound();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [recentEmojis, setRecentEmojis] = useState<EmojiItem[]>([]);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const recents = RecentStore.get();
      setRecentEmojis(
        recents.map((native) => ({
          id: `rec-${native}`,
          native,
          name: native,
          keywords: [],
        }))
      );
    }
    if (typeof document !== 'undefined') {
      setIsDark(document.documentElement.classList.contains('dark'));
    }
  }, [isOpen]);

  const handleSelect = (emoji: EmojiItem) => {
    play('pop');
    RecentStore.add(emoji.native);
    onEmojiSelect(emoji);
    onClose();
  };

  const handleTabSelect = (categoryId: string) => {
    play('click');
    setActiveCategory(categoryId);
    const el = document.getElementById(`category-${categoryId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleTheme = () => {
    play('switch');
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (typeof document !== 'undefined') {
      if (nextDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  if (!isOpen) return null;

  const displayCategories = [
    ...(recentEmojis.length > 0
      ? [{ id: 'recent', name: 'Usados Recientemente', emojis: recentEmojis }]
      : []),
    ...FULL_EMOJI_CATEGORIES,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 pointer-events-auto bg-black/35 backdrop-blur-xs animate-in fade-in"
        onClick={onClose}
      />

      {/* Floating Modal Card */}
      <div className="pointer-events-auto relative flex flex-col w-[340px] h-[440px] max-w-[92vw] max-h-[85vh] bg-card/95 backdrop-blur-3xl border border-border/80 rounded-[24px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-foreground">
        <EmojiSearch
          value={searchQuery}
          onChange={setSearchQuery}
          isDark={isDark}
          toggleTheme={toggleTheme}
        />

        <EmojiGrid
          categories={displayCategories}
          searchQuery={searchQuery}
          onSelect={handleSelect}
          activeCategory={activeCategory}
          onScrollCategory={setActiveCategory}
        />

        {!searchQuery && (
          <CategoryTabs activeCategory={activeCategory} onSelect={handleTabSelect} />
        )}
      </div>
    </div>
  );
};

export const Component = AppleEmojiPicker;
export default AppleEmojiPicker;
