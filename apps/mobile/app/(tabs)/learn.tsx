import { ChevronRight, Droplet, Search, Shield, Sparkles, Sun } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LearnScreen() {
  const [activeCategory, setActiveCategory] = useState('All');

  const categories = ['All', 'Acne', 'Anti-Aging', 'Routine', 'Dry Skin'];

  const articles = [
    {
      id: 1,
      category: 'Basics',
      title: 'The correct order to apply skincare',
      readTime: '3 min read'
    },
    {
      id: 2,
      category: 'Acne',
      title: 'Why you should never pop a pimple',
      readTime: '2 min read'
    },
    {
      id: 3,
      category: 'Sun',
      title: 'SPF 30 vs SPF 50: What is the difference?',
      readTime: '5 min read'
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Skin Education</Text>
        <TouchableOpacity style={styles.searchBtn}>
          <Search size={20} color="#374151" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        
        <View style={styles.dailyTipContainer}>
          <View style={styles.dailyHeader}>
            <Sparkles size={18} color="#B45309" />
            <Text style={styles.dailyTitle}>Tip of the Day</Text>
          </View>
          <Text style={styles.dailyText}>
            "Hydration isn't just about water. Eating water-rich foods like cucumber and watermelon helps your skin glow from within."
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Dermatology Essentials</Text>
        <View style={styles.grid}>
          <TouchableOpacity style={[styles.gridItem, { backgroundColor: '#EFF6FF' }]}>
            <Droplet size={24} color="#2563EB" />
            <Text style={[styles.gridLabel, { color: '#1E40AF' }]}>Hydration</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.gridItem, { backgroundColor: '#FEF3C7' }]}>
            <Sun size={24} color="#D97706" />
            <Text style={[styles.gridLabel, { color: '#92400E' }]}>Sun Care</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.gridItem, { backgroundColor: '#ECFDF5' }]}>
            <Shield size={24} color="#059669" />
            <Text style={[styles.gridLabel, { color: '#065F46' }]}>Protection</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          {categories.map((cat) => (
            <TouchableOpacity 
              key={cat} 
              style={[styles.catChip, activeCategory === cat && styles.catChipActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.catText, activeCategory === cat && styles.catTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.articlesList}>
          {articles.map((article) => (
            <TouchableOpacity key={article.id} style={styles.card}>
              <View style={styles.cardContent}>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardCategory}>{article.category}</Text>
                  <Text style={styles.cardTime}>{article.readTime}</Text>
                </View>
                <Text style={styles.cardTitle}>{article.title}</Text>
                <View style={styles.readMore}>
                  <Text style={styles.readMoreText}>Read Article</Text>
                  <ChevronRight size={16} color="#2563EB" />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  searchBtn: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 20 },

  content: { flex: 1 },

  dailyTipContainer: { margin: 20, padding: 16, backgroundColor: '#FFFBEB', borderRadius: 16, borderWidth: 1, borderColor: '#FEF3C7' },
  dailyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dailyTitle: { fontWeight: 'bold', color: '#92400E', fontSize: 14, textTransform: 'uppercase' },
  dailyText: { fontSize: 16, color: '#78350F', fontStyle: 'italic', lineHeight: 24 },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginLeft: 20, marginBottom: 12 },

  grid: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 24 },
  gridItem: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', height: 100 },
  gridLabel: { marginTop: 8, fontWeight: '600', fontSize: 12 },

  catScroll: { paddingHorizontal: 20, marginBottom: 20 },
  catChip: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: 'white', marginRight: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  catChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  catText: { color: '#4B5563', fontWeight: '600' },
  catTextActive: { color: 'white' },

  articlesList: { paddingHorizontal: 20, gap: 16 },
  card: { backgroundColor: 'white', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: {width:0, height:2}, shadowRadius: 4, elevation: 2 },
  cardImage: { width: '100%', height: 160 },
  cardContent: { padding: 16 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardCategory: { color: '#2563EB', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' },
  cardTime: { color: '#9CA3AF', fontSize: 12 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 12, lineHeight: 26 },
  readMore: { flexDirection: 'row', alignItems: 'center' },
  readMoreText: { color: '#2563EB', fontWeight: '600', fontSize: 14, marginRight: 4 },
});