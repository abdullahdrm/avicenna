import { ChevronRight, Droplet, Search, Shield, Sparkles, Sun } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../../lib/LanguageContext';
import { usePatientTheme } from '../../lib/PatientThemeContext';

interface Article {
  id: number;
  title: string;
  category: string;
  read_time: string;
  content: string;
  image: string | null;
}

interface DailyTip {
  id: number;
  content: string;
}

export default function LearnScreen() {
  const { t } = useLanguage();
  const { colors } = usePatientTheme();
  const [activeCategory, setActiveCategory] = useState('All');
  const [articles, setArticles] = useState<Article[]>([]);
  const [dailyTip, setDailyTip] = useState<DailyTip | null>(null);
  const [loading, setLoading] = useState(true);

  const BASE_URL = 'http://10.136.227.43:8000';
  const categories = ['All', 'Acne', 'Anti-Aging', 'Routine', 'Dry Skin', 'Sun', 'Basics'];

  const fetchData = async () => {
    setLoading(true);
    try {
      let articleUrl = `${BASE_URL}/api/articles/`;
      if (activeCategory !== 'All') {
        articleUrl += `?category=${activeCategory}`;
      }

      const [tipRes, articleRes] = await Promise.all([
        fetch(`${BASE_URL}/api/tips/random/`),
        fetch(articleUrl)
      ]);

      if (tipRes.ok) {
        const tipJson = await tipRes.json();
        setDailyTip(tipJson);
      }

      if (articleRes.ok) {
        const articleJson = await articleRes.json();

        if (Array.isArray(articleJson)) {
          setArticles(articleJson);
        } else if (articleJson.results) {
          setArticles(articleJson.results);
        } else {
          setArticles([]);
        }
      }

    } catch (error) {
      console.error("Failed to fetch learn content:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeCategory]);

  const getImageUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${BASE_URL}${path}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('learnScreen.skinEducation')}</Text>
        <TouchableOpacity style={[styles.searchBtn, { backgroundColor: colors.surfaceAlt }]} onPress={fetchData}>
          <Search size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>

        <View style={styles.dailyTipContainer}>
          <View style={styles.dailyHeader}>
            <Sparkles size={18} color="#B45309" />
            <Text style={styles.dailyTitle}>{t('learnScreen.tipOfTheDay')}</Text>
          </View>
          <Text style={styles.dailyText}>
            {dailyTip ? `"${dailyTip.content}"` : `"${t('learnScreen.loading')}"`}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('learnScreen.dermatologyEssentials')}</Text>
        <View style={styles.grid}>
          <TouchableOpacity style={[styles.gridItem, { backgroundColor: '#EFF6FF' }]} onPress={() => setActiveCategory('Dry Skin')}>
            <Droplet size={24} color="#2563EB" />
            <Text style={[styles.gridLabel, { color: '#1E40AF' }]}>{t('learnScreen.hydration')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.gridItem, { backgroundColor: '#FEF3C7' }]} onPress={() => setActiveCategory('Sun')}>
            <Sun size={24} color="#D97706" />
            <Text style={[styles.gridLabel, { color: '#92400E' }]}>{t('learnScreen.sunCare')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.gridItem, { backgroundColor: '#ECFDF5' }]} onPress={() => setActiveCategory('Basics')}>
            <Shield size={24} color="#059669" />
            <Text style={[styles.gridLabel, { color: '#065F46' }]}>{t('learnScreen.protection')}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, { backgroundColor: colors.surface, borderColor: colors.border }, activeCategory === cat && styles.catChipActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.catText, { color: colors.mutedText }, activeCategory === cat && styles.catTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.articlesList}>
          {loading ? (
            <ActivityIndicator size="large" color="#2563EB" />
          ) : (
            articles.length === 0 ? (
              <Text style={{ textAlign: 'center', color: colors.mutedText, marginTop: 20 }}>
                {t('learnScreen.noArticles')} {activeCategory}.
              </Text>
            ) : (
              articles.map((article) => (
                <TouchableOpacity key={article.id} style={[styles.card, { backgroundColor: colors.surface }]}>
                  {article.image && (
                    <Image
                      source={{ uri: getImageUrl(article.image) as string }}
                      style={styles.cardImage}
                      resizeMode="cover"
                    />
                  )}

                  <View style={styles.cardContent}>
                    <View style={styles.cardMeta}>
                      <Text style={styles.cardCategory}>{article.category}</Text>
                      <Text style={[styles.cardTime, { color: colors.faintText }]}>{article.read_time}</Text>
                    </View>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{article.title}</Text>
                    <Text style={{ color: colors.mutedText, marginBottom: 12 }} numberOfLines={2}>
                      {article.content}
                    </Text>
                    <View style={styles.readMore}>
                      <Text style={styles.readMoreText}>Read Article</Text>
                      <ChevronRight size={16} color="#2563EB" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )
          )}
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
  cardImage: { width: '100%', height: 160, backgroundColor: '#E5E7EB' },
  cardContent: { padding: 16 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardCategory: { color: '#2563EB', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' },
  cardTime: { color: '#9CA3AF', fontSize: 12 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 8, lineHeight: 26 },
  readMore: { flexDirection: 'row', alignItems: 'center' },
  readMoreText: { color: '#2563EB', fontWeight: '600', fontSize: 14, marginRight: 4 },
});
